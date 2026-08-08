# Slope ranking module (compatible with older versions)

This two-phase contract is for compatibility with legacy input and regression testing only. New requests should use [`bump-ranking-module.md`](./bump-ranking-module.md), the current official module ID for `bump-ranking`.

Applicable:5–12 Each object has a unique ranking and value at two time points, and the slope is used to express the migration.

Required input: left and right time points, object name, two period rankings and values, reason for movement and source.

Blocking: Stopping when the ranking is repeated at the same time point, the change in caliber at the time point is not explained, or only the ranking change is given without ranking at both ends. It is prohibited to rewrite the reason for the increase.
