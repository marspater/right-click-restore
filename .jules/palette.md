# Palette 🎨 UI/UX Journal

## Journal Entry - Extension Paused State Polish & Accessibility

### What was improved
- **State Communication on Active Domain Card**: Disambiguated extension state when global toggle is OFF. Display "Extension Paused" with a neutral status beacon instead of contradictory "Disabled on Domain" alongside an active switch.
- **Affordances & Disabled Interaction Feedback**: Automatically disable the per-domain toggle switch, feature list item rows, and the "Force Unlock Page Now" button when global extension is turned off.
- **Hover & Focus Polish**: Added `cursor-not-allowed` styles and removed hover highlights on feature rows when disabled.
- **Accessibility**: Enhanced `aria-label` screen reader descriptions to include the active domain name (`Toggle domain protection for ${currentHostname}`) and added informative tooltips.
