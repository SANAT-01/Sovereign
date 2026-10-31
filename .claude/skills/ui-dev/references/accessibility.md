# Accessibility Checklist

Practical minimum for every module — for a fuller audit, invoke the installed `web-design-guidelines` skill.

## Forms
- Every input has a real `<label>` (via `htmlFor`/`id`, not just placeholder text — placeholders disappear on input and aren't reliably read by screen readers).
- Error messages are associated with their field (`aria-describedby`) and not conveyed by color alone.
- Submit buttons have clear, specific text ("Save expense," not just "Submit").

## Interactive elements
- Use `<button>` for actions, `<a>` for navigation — don't make a `<div onClick>` do either job; it breaks keyboard access and screen reader semantics for free otherwise.
- Every interactive element is reachable and operable via keyboard alone (Tab to focus, Enter/Space to activate) — test this manually for any custom component (modal, dropdown, tag picker).
- Focus is managed on modal open/close (focus moves into the modal, returns to the trigger on close) — don't leave focus stranded on a removed element.

## Color and contrast
- Text meets WCAG AA contrast against its background in both light and dark mode (check with a contrast checker, not by eye) — easy to miss in dark mode since token colors chosen for light mode don't automatically carry over.
- Never convey state (error, success, disabled) through color alone — pair with an icon or text.

## Images and icons
- Decorative icons get `aria-hidden="true"`. Icons that convey meaning on their own (no adjacent text) get an accessible label (`aria-label` or visually-hidden text).

## Quick manual check before marking a feature done
Tab through the feature's UI with the mouse untouched — if you can't reach and operate everything, fix it before calling the feature done (this folds into the `feature-validator` agent's real run-through step).
