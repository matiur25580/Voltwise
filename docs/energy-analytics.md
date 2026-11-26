# Energy analytics

## Endpoint

`GET /api/v1/analytics/energy` requires an access token and the `energy:read` permission.

Query parameters:
- `from`, `to`: ISO-8601 timestamps. Defaults to the previous 30 days and now.
- `granularity`: `day` (default) or `hour`.
- `assetId`: optional 24-character asset ID. The aggregation remains tenant-scoped.
- `tariffRate`: optional flat INR/kWh assumption from 0 through 1000.

The maximum query window is 90 days. All buckets are UTC.

## Calculation semantics

- Imported energy sums `energy_import` readings. Wh is divided by 1,000; kWh is unchanged.
- Exported energy sums `energy_export` readings using the same conversion.
- Peak and average demand use `active_power` samples. W is divided by 1,000; kW is unchanged. These are sampled values, not time-integrated energy.
- Generation peak uses `generation_power` samples, converted from W to kW when needed.
- Estimated import cost is imported kWh multiplied by the explicitly supplied flat tariff. No tariff is assumed by the API.
- Anomaly screening compares a bucket with up to seven preceding daily buckets (or 24 hourly buckets), requires at least three positive baseline buckets, and flags increases of at least 25%.

## Limitations

This is a transparent baseline analytics layer, not a forecasting engine or utility billing system. It does not infer missing intervals, normalize for weather/occupancy, model time-of-use tariffs, calculate demand charges, or diagnose equipment faults. Data quality and meter calibration remain the responsibility of the integrating operator.
