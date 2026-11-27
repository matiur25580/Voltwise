# Demand response and battery optimization

## Scope
Voltwise adds a decision-support simulator for demand-response scenarios. It does not send commands to batteries, inverters, meters, building-management systems, or utility aggregators. Approval is an internal workflow decision only; dispatch remains a future integration requiring device-level safety controls and operator authorization.

## Workflow
1. Register active battery assets under a facility and record capacity in kWh or MWh.
2. Submit an operator-provided baseline load profile (15-, 30-, or 60-minute intervals), a demand cap, initial and reserve state-of-charge assumptions, and a maximum discharge-power limit.
3. The server verifies every selected battery belongs to the authenticated tenant, is active, is a battery, and is in the same facility.
4. The simulator recommends discharge only when baseline load exceeds the target, respecting usable battery energy and configured discharge power.
5. The proposal stores assumptions, interval schedule, summary, and audit event. An energy writer can approve or reject it with a note.

## API
- POST /api/v1/flexibility/simulations — create a scenario.
- GET /api/v1/flexibility/simulations — list the current tenant's scenarios.
- POST /api/v1/flexibility/simulations/:planId/decision — approve or reject a proposed scenario.

Write endpoints require energy:write; listing requires energy:read. Requests are tenant-scoped and battery IDs are validated against the current tenant. Profiles are limited to 96 intervals. Optional tariff assumptions must provide one non-negative INR/kWh rate per interval.

## Calculation and limitations
For each interval, recommended discharge is the minimum of load above target demand, configured maximum discharge kW, and remaining usable battery energy divided by interval duration. Usable energy is registered battery capacity multiplied by the difference between initial and reserve state of charge. Estimated avoided energy cost is avoided kWh multiplied by the supplied rate; it excludes round-trip losses, degradation, demand charges, taxes, network constraints, and market settlement.

Load profiles and state-of-charge values are operator-provided scenario assumptions, not verified telemetry. The model assumes aggregate battery power and energy can be dispatched together and does not optimize charging, time-of-use arbitrage, renewable forecasts, EV flexibility, or grid constraints. No physical command is issued. Approval does not imply execution or a measured outcome.
