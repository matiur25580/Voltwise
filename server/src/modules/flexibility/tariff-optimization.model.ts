import { Schema, model } from "mongoose";
const intervalSchema = new Schema({
 index:{type:Number,required:true}, tariffRateInrPerKwh:{type:Number,required:true},
 action:{type:String,enum:["charge","discharge","hold"],required:true}, powerKw:{type:Number,required:true},
 energyChangeKwh:{type:Number,required:true}, stateOfChargePercent:{type:Number,required:true}, gridCostInr:{type:Number,required:true}
},{_id:false});
const schema=new Schema({
 tenantId:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true},
 facilityId:{type:Schema.Types.ObjectId,ref:"Facility",required:true},
 batteryAssetIds:[{type:Schema.Types.ObjectId,ref:"EnergyAsset",required:true}],
 name:{type:String,required:true,trim:true,maxlength:120}, intervalMinutes:{type:Number,required:true},
 batteryCapacityKwh:{type:Number,required:true}, maxChargeKw:{type:Number,required:true}, maxDischargeKw:{type:Number,required:true},
 initialSocPercent:{type:Number,required:true}, minimumSocPercent:{type:Number,required:true}, maximumSocPercent:{type:Number,required:true},
 roundTripEfficiencyPercent:{type:Number,required:true}, tariffRatesInrPerKwh:{type:[Number],required:true},
 schedule:{type:[intervalSchema],required:true},
 summary:{totalGridCostInr:{type:Number,required:true},estimatedArbitrageMarginInr:{type:Number,required:true},chargedEnergyKwh:{type:Number,required:true},dischargedEnergyKwh:{type:Number,required:true}},
 status:{type:String,enum:["proposed","approved","rejected"],default:"proposed",required:true},
 decisionNote:{type:String,trim:true,maxlength:1000,default:""},
 createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},decidedBy:{type:Schema.Types.ObjectId,ref:"User",default:null},decidedAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
schema.index({tenantId:1,createdAt:-1}); schema.index({tenantId:1,status:1,createdAt:-1});
export const TariffOptimization=model("TariffOptimization",schema);
