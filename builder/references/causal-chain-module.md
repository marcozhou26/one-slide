# Causal chain module

## Entry conditions

The original text must clearly use causal expressions such as "causing, causing, driving, increasing, elongating, delaying". Only related, parallel, simultaneous or temporal sequence cannot enter the causal chain module.

## modeling rules

- Cause points to effect.
- Each arrow saves the original text basis.
- The same cause can affect multiple outcomes, and the same outcome can have multiple causes.
- No intermediate mechanism is added; intermediate nodes must appear in the original text.
- The graph must be cycle-free.
- It can be used if it is missing but needs to be supplemented by the customer. `To be supplemented by customers` node.
- Return when there are two reasonable understandings of the causal direction `LOGIC_AMBIGUITY_BLOCKED`.

## Page rules

- Use a left-to-right reading direction.
- The cause is on the left and the end result is on the right.
- The connection lines are created first, and the nodes are created later.
- The node retains its original text and is not changed to a new label.
- Titles must not be forced to break.
- Customer pages do not show anchors and internal state.
