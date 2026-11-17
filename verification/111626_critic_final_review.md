# Visual critic: final review (round 7)

**Gate status: not passed.** The gate was "iterate until the critic reports nothing above minor".
After seven rounds the critic's highest severity was still MAJOR.

## How the critic was run

- A separate Claude subagent (Claude Sonnet 5.5) was given a folder of 20 PNG renders at 2560×1440 and nothing
  else: no source code, no notes on how the scene was built, no earlier reviews.
- Renders came from Firefox 159.0.1 via `verification/111626_capture_renders.py`: 12 settled views (home, each
  section, the research sub-menu and its three plates) and 8 sheets of stepped animation frames (intro zoom,
  moves to the bottle, notebook with page flip, a drawer, and the plates with a lid lifting).
- Its brief was the owner's scene description, the file list, four severity definitions, and capture notes
  (for example that interface fades appear as pops in stepped stills).
- Each round used a fresh subagent, so no round saw another round's report.

## Round history

| Round | Highest | Main points raised | What changed afterwards |
|---|---|---|---|
| 1 | MAJOR | Tags covering objects; cards covering neighbours; dull casework; liquids and foil caps reading as artificial; clickable items small | Tag placement, card width and camera offsets, door labels, pleated foil cap, clearer liquids |
| 2 | MAJOR | Drawer views showed mostly floor; notebook glare and reflection streaks; weak or similar highlight colours; liquids "like paint" | Drawer camera keeps the bench in frame; darker paper; new highlight blend and colours; refraction restored (a regression from a speed change) |
| 3 | MAJOR | Home view cropping side props; tags too large; drawer highlights unlike the others; banding; smeared reflections | Narrower diorama that fits the home frame; smaller tags; handle-and-label drawer highlight; banding fixed |
| 4 | MAJOR | Skills close-up framing; plates and glass glowing less than drawers; header on busy content | Skills reframed; stronger glow; header given a backing |
| 5 | MAJOR | Plate lid reading as a ghost; empty mat in plate close-ups; Skills lower third empty; smeared reflections | Closer plate close-ups, lower lid lift, wider plate spacing, sharper and fainter reflections, front fill light |
| 6 | MAJOR | Plates hardest to find at home; blurry colonies; dark notebook view; note text running off the page in the flip | Plate halos; higher-resolution colony textures; tighter notebook view; note lines fitted to the page |
| 7 | MAJOR | See below | Three concrete defects fixed after this round (not re-reviewed) |

Some later rounds asked for the opposite of earlier ones: round 5 wanted the whole drawer front highlighted
where round 3 had objected to that, round 5 wanted shorter tag stems where rounds 1 and 4 wanted tags moved
clear of objects, and the Skills close-up was criticised as too far (round 4), too high (round 5) and "too far
and too low" (round 7).

## Round 7 report (as returned)

**MAJOR**
- `10_publications`, `sheet_40_publications_1`: the Publications card sits over the right-hand bench and its
  top edge overlaps the Mason and Wolchok plates, which are cut off at the right.
- `21_wolchok`: the card's lower-left corner overlaps the teal tube rack; a dark wedge and a red pen end show
  at the top right behind the card.
- `10_skills`: tubes in the left third, empty beige bench in the lower 20% and at the top; an outlet
  half-covered by the card's tab; the timer cropped at the right edge. "The camera is too far and too low."
- `10_teaching`: the notebook sits on a nearly black bench and the frame is very dark; the hotplate is cropped
  at the top right; a tree-diagram node collides with the last line of the left-page text.

**MODERATE**
- `01_home`: Research plates have the weakest glow; Skills and Research tags are close together.
- `01_home`: drawer label text is low contrast under its glow.
- `01_home`: pipette tips crowd the back rail; the nitrogen cylinder is cropped at the left.
- `10_education`, `10_honors`: the card covers the right half of the shelf; sticky notes are cut by the frame.
- `10_education`: label and tape look flat against the glass; a dark band where the liquid meets the glass.
- `10_contact`, `10_ack`: neighbouring drawer labels are cut by the card or frame edge; the Acknowledgments
  card is dense; the ramen cup looks unfinished.
- `sheet_31_intro_1`: the diorama is small in the opening frames and its walls read as a thin slab.
- `sheet_40_teaching_1`: turning pages show a hard edge and no paper thickness; the leaf is cropped by the
  frame top in two frames.
- `21_*`: colonies read as soft blobs; a brightness break across the agar; the laid-down lid is faint.

**MINOR**
- Footer credit and hint pill are small; the hint sits over the stool.
- The paper in the Publications drawer has placeholder grey lines.
- Tube caps darken toward their lower edge.
- The back button overlaps scene objects in two views.
- `20_research`: bare mat fills about 40% of the frame.

**What it said works**
- Home view: strong evening mood, warm under-shelf light, convincing lab density, readable tag colours.
- The notebook Teaching spread: "the best view", crisp handwriting, nothing covered.
- Shelf glassware and the bench reflections.
- Cards: consistent typography, colour-coded tabs, link pills.
- Camera moves are smooth; the plate lid animation "lands cleanly beside the dish".
- Pipettes hang with nothing below, as the brief wanted.

## After round 7

These were fixed and checked by eye, but have not been shown to the critic:
- The Publications card moved to the left so the drawer and the plates are both clear.
- The tube rack and red pen moved out of the Wolchok close-up.
- The notebook doodle moved below the text.
