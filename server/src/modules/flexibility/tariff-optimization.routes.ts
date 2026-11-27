import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AuthError } from "../identity/auth.service.js";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../identity/auth.middleware.js";
import { AuditEvent } from "../identity/audit-event.model.js";
import { EnergyAsset } from "../assets/energy-asset.model.js";
import { TariffOptimization } from "./tariff-optimization.model.js";
import { optimizeTimeOfUseSchedule } from "./tariff-optimization.service.js";
export const tariffOptimizationRouter=Router();
const id=z.string().regex(/^[a-f0-9]{24}$/i);
const createSchema=z.object({
 name:z.string().trim().min(3).max(120),batteryAssetIds:z.array(id).min(1).max(20),
 intervalMinutes:z.number().int().refine(x=>[15,30,60].includes(x)),
 tariffRatesInrPerKwh:z.array(z.number().finite().min(0).max(1000)).min(1).max(96),
 maxChargeKw:z.number().positive().max(100000),maxDischargeKw:z.number().positive().max(100000),
 initialSocPercent:z.number().min(0).max(100),minimumSocPercent:z.number().min(0).max(95),
 maximumSocPercent:z.number().min(5).max(100),roundTripEfficiencyPercent:z.number().min(50).max(100)
}).superRefine((v,ctx)=>{
 if(v.minimumSocPercent>=v.initialSocPercent)ctx.addIssue({code:"custom",path:["minimumSocPercent"],message:"Minimum SoC must be below initial SoC."});
 if(v.initialSocPercent>v.maximumSocPercent)ctx.addIssue({code:"custom",path:["initialSocPercent"],message:"Initial SoC cannot exceed maximum SoC."});
});
const decisionSchema=z.object({decision:z.enum(["approve","reject"]),note:z.string().trim().max(1000).default("")});
tariffOptimizationRouter.post("/flexibility/tariff-optimizations",requireAuth,requirePermission("energy:write"),async(req:AuthenticatedRequest,res,next)=>{
 try{
  const input=createSchema.parse(req.body),tenantId=req.auth!.tenantId,ids=[...new Set(input.batteryAssetIds)];
  const batteries=await EnergyAsset.find({_id:{$in:ids},tenantId,type:"battery",status:"active"}).select("_id facilityId capacity").lean();
  if(batteries.length!==ids.length)throw new AuthError("BATTERY_SCOPE_INVALID","Every selected battery must be active and registered to this organization.",404);
  const facilities=[...new Set(batteries.map(x=>x.facilityId.toString()))];
  if(facilities.length!==1)throw new AuthError("BATTERY_FACILITY_MISMATCH","Selected batteries must belong to one facility.",400);
  const capacity=batteries.reduce((sum,b)=>sum+(b.capacity?.unit?.toLowerCase()==="mwh"?(b.capacity.value??0)*1000:b.capacity?.unit?.toLowerCase()==="kwh"?(b.capacity.value??0):0),0);
  if(capacity<=0)throw new AuthError("BATTERY_CAPACITY_MISSING","Selected batteries need capacity in kWh or MWh.",400);
  const optimized=optimizeTimeOfUseSchedule({...input,batteryCapacityKwh:capacity});
  const plan=await TariffOptimization.create({...input,tenantId,facilityId:new Types.ObjectId(facilities[0]),batteryAssetIds:batteries.map(x=>x._id),batteryCapacityKwh:capacity,...optimized,createdBy:req.auth!.userId,status:"proposed"});
  await AuditEvent.create({tenantId,actorUserId:req.auth!.userId,action:"flexibility.tariff_optimization.created",resourceType:"tariff_optimization",resourceId:plan.id,metadata:{batteryAssetIds:ids,estimatedArbitrageMarginInr:optimized.summary.estimatedArbitrageMarginInr}});
  res.status(201).json({data:plan});
 }catch(error){next(error);}
});
tariffOptimizationRouter.get("/flexibility/tariff-optimizations",requireAuth,requirePermission("energy:read"),async(req:AuthenticatedRequest,res,next)=>{
 try{const plans=await TariffOptimization.find({tenantId:req.auth!.tenantId}).sort({createdAt:-1}).limit(100).populate({path:"facilityId",select:"name code"}).populate({path:"batteryAssetIds",select:"name assetTag capacity"}).lean();res.json({data:plans});}
 catch(error){next(error);}
});
tariffOptimizationRouter.post("/flexibility/tariff-optimizations/:planId/decision",requireAuth,requirePermission("energy:write"),async(req:AuthenticatedRequest,res,next)=>{
 try{
  const planId=id.parse(req.params.planId),input=decisionSchema.parse(req.body);
  const plan=await TariffOptimization.findOneAndUpdate({_id:planId,tenantId:req.auth!.tenantId,status:"proposed"},{$set:{status:input.decision==="approve"?"approved":"rejected",decisionNote:input.note,decidedBy:new Types.ObjectId(req.auth!.userId),decidedAt:new Date()}},{new:true,runValidators:true});
  if(!plan){const exists=await TariffOptimization.exists({_id:planId,tenantId:req.auth!.tenantId});if(!exists)throw new AuthError("TARIFF_PLAN_NOT_FOUND","Tariff optimization was not found in this organization.",404);throw new AuthError("TARIFF_PLAN_ALREADY_DECIDED","Only proposed optimizations can be decided.",409);}
  await AuditEvent.create({tenantId:req.auth!.tenantId,actorUserId:req.auth!.userId,action:"flexibility.tariff_optimization."+input.decision,resourceType:"tariff_optimization",resourceId:plan.id,metadata:{note:input.note}});
  res.json({data:plan});
 }catch(error){next(error);}
});
