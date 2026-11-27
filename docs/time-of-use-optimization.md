# Time-of-use battery scheduling

Voltwise includes an indicative tariff-aware battery scheduling heuristic. Operators provide ordered INR/kWh tariff rates and battery operating assumptions. The optimizer classifies lower-rate intervals as charge opportunities and higher-rate intervals as discharge opportunities, while respecting configured power, minimum and maximum state of charge, interval duration, and round-trip efficiency.

## Important limitations
- This is a deterministic heuristic, not a mathematical global optimum or market bidding engine.
- Tariff values are operator-provided assumptions; no utility tariff is automatically inferred.
- The schedule is not a dispatch command and does not control a physical battery.
- It assumes one aggregate battery and excludes degradation cost, demand charges, taxes, network limits, export compensation, solar forecasts, and telemetry-confirmed state of charge.
- The estimated arbitrage margin is not verified bill savings. Review all assumptions before operational use.
