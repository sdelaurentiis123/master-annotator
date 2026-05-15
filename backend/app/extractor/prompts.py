"""Gemini prompt for per-page annotation extraction.

Curly braces in the bracket example are doubled so `.format(dpi=, width=, height=)`
doesn't trip over them.
"""

PROMPT_TEMPLATE = """\
You are extracting human annotations from a single page of an academic paper. The annotator
is a domain expert; their marks correspond to concrete edits the paper's author should make.

The page has been rasterized at {dpi} DPI (image: {width}×{height} pixels).

ALL bounding boxes you return MUST be in NORMALIZED coordinates: [x0, y0, x1, y1] where each
value is an integer in 0–1000, with (0, 0) at the top-left and (1000, 1000) at the bottom-right
of the image. This is Gemini's standard 2D bounding box format.

# Step 1: SEE every mark

Be EXHAUSTIVE. Look hard at every region — top/bottom/left/right margins, gaps between
printed lines, header and footer areas, gutters between columns, individual letters or
punctuation. Faint pencil marks, single dots, tiny carets, and short underlines are easy to
miss. If you are uncertain whether something is a mark, include it with lower confidence;
omitting a real mark is worse than including a doubtful one.

Do NOT include original printed text, figures, equations, or printed page furniture
(headers, page numbers, copyright lines, MNRAS preprint stamps).

# Step 2: CLASSIFY each mark visually first, then editorially

For every mark, name its SHAPE based on how it looks, and its TYPE based on the editorial
intent. Reason about shape from the visual evidence before guessing intent.

## SHAPES — what does the mark physically look like?

  - "strikethrough":  ONE roughly horizontal line drawn through printed text. Clean, surgical.
  - "scribble":       chaotic, multi-pass back-and-forth scratch over printed text. More
                      emphatic than a strikethrough; the printed text underneath may be
                      partially obliterated.
  - "caret":          a small "^" or "v" wedge between two characters or words, marking an
                      insertion point. Almost always paired with handwritten inserted text
                      nearby (above the line, in the margin, or connected by an arrow).
  - "circle":         a closed loop drawn AROUND a word, letter, number, or short phrase,
                      leaving the printed text visible inside the loop.
  - "underline":      a single straight or wavy line drawn UNDER printed text (NOT through it).
  - "highlight":      a translucent colored fill (yellow, pink, etc.) over printed text. NOT
                      a line, NOT a circle. If it's just a line under text, that is "underline",
                      not "highlight".
  - "bracket":        a square "[" "]" or curly "{{" "}}" bracket spanning a range of printed
                      lines or words, grouping them.
  - "arrow":          a line with a clear arrowhead, connecting one location to another.
                      Often the body of a margin annotation: writing at the tail, target at
                      the head. If the mark is JUST an arrow with no writing, shape is "arrow".
                      If writing PLUS an arrow, shape is "handwriting" and has_arrow=true.
  - "handwriting":    any handwritten word, phrase, equation, or symbol that doesn't fit the
                      above shapes (margin notes, inserted words, comments, formulas).
  - "dot":            a single dot, star, or asterisk used to mark a spot.

## TYPES — what does the annotator WANT?

  - "delete":      remove this from the source document.
  - "insert":      add new text at this location in the source.
  - "replace":     substitute the existing text with new text.
  - "comment":     a note or remark that does not change the printed text but adds discussion.
  - "question":    an interrogative — the annotator is asking or uncertain.
  - "emphasize":   "this is important / note this" — pure emphasis without a specific change.
  - "flag":        the annotator is flagging the spot for later attention without yet
                   specifying a change (e.g. a circle around a word with no further note).

## Typical shape → type mappings (use as a STRONG prior, but visual evidence wins)

  strikethrough alone               → delete
  strikethrough + handwriting near  → replace        (handwriting = the replacement text)
  scribble                          → delete         (emphatic)
  caret + handwriting               → insert         (handwriting = the inserted text)
  circle alone (no note)            → flag           (or replace if the circle is around a
                                                      single capital letter — implies lowercase)
  circle + handwriting near         → replace or comment, depending on what was written
  underline alone                   → emphasize
  highlight (true fill) alone       → emphasize
  bracket alone                     → emphasize      (the bracketed range)
  bracket + handwriting             → comment        (the note applies to the bracketed range)
  handwriting with an arrow         → comment / replace / insert, depending on the writing
  arrow only (no writing)           → flag           (just a pointer)
  dot / asterisk alone              → flag

# Step 3: USE spatial clustering and coordinate related marks

Two distinct rules apply, and you must pick the right one for each cluster of marks:

## Rule A — REPEATED edits across the page (separate annotations)

When the SAME shape appears in MULTIPLE locations on different printed targets, each is its
own edit. Example: six separate circles around six different capital letters in a paper title
→ emit six annotations. Their intents should be uniform ("lowercase this letter"), because
the annotator is doing one thing six times, but each targets a different printed location.

## Rule B — COORDINATED marks for a SINGLE edit (merge into one annotation)

When two or more marks at the SAME printed target work together to express ONE editorial
action, emit EXACTLY ONE Annotation. Do NOT emit a separate annotation for each contributing
mark — that produces duplicates with the same intent and confuses downstream agents.

Common coordinated patterns (always ONE annotation, not multiple):

  - circle around the wrong letter / word  +  the correction handwritten nearby (often
    connected by an arrow) → ONE annotation:
      shape = "handwriting"  (the writing is the most informative mark)
      type = "replace"
      anchor_text = the printed text being changed
      annotation_content = the handwritten correction
      bbox = the bounding union of the handwriting AND the circle
      anchor_bbox = the circled / target printed text
      has_arrow = true if a connector is drawn
      intent = e.g. 'replace the "y" of "eccentricity" with "ies" to spell "eccentricities"'

  - strikethrough  +  replacement handwritten nearby → ONE annotation (type="replace", shape
    typically "handwriting"; the strike is part of the same edit).

  - caret  +  the handwritten word that goes there → ONE annotation (type="insert",
    shape="handwriting"; the caret is part of the same edit).

  - bracket / underline  +  a margin comment about the bracketed range → ONE annotation
    (type="comment", shape="handwriting"; the bracket is the scope indicator).

  - arrow (alone, no writing at its tail)  +  the writing it visually connects to → ONE
    annotation centered on the writing, has_arrow=true.

When deciding: if you would produce multiple annotations whose intents are essentially
synonyms ("replace y with ies" twice), STOP — collapse them into one.

## Sanity check before finalizing the list

Scan your list once more. For any two annotations that share the same anchor_text and
whose intents are paraphrases of each other, merge them per Rule B.

# Field rules

  bbox:        tight bbox (0–1000 normalized) of the MARK ITSELF — the writing/strike/circle.
               For a margin note with an arrow, this is the WRITING, NOT the arrow target.

  anchor_bbox: tight bbox (0–1000 normalized) of the PRINTED TEXT this mark refers to. For
               arrows: the words at the ARROW TIP. For strikethroughs: the words being crossed
               out. For circles: the encircled printed text. Empty list [] only if no printed
               text is involved (e.g. a standalone margin doodle).

  anchor_text: exact printed transcription at anchor_bbox. Required whenever anchor_bbox is set.

  context_text: 1–2 surrounding printed sentences (~25 words max) giving a downstream agent
               enough context to locate this region in the source LaTeX. Include the sentence
               containing anchor_text; trim aggressively.

  annotation_content: OCR of what the HUMAN wrote. Empty string for marks with no writing
               (plain underline, plain strikethrough, lone circle, etc.).

  intent:      ONE imperative English sentence describing the desired change. Concrete.
               Examples: 'delete the phrase "foo bar"', 'replace "Systems" with the subtitle
               nothing — remove it', 'insert "this asymmetry" before "However"',
               'the annotator is asking what 1.01 refers to', 'lowercase the "A" in "Accretion"'.

  has_arrow:   true if the mark itself includes (or is attached to) an arrow / connector line
               linking the writing to a separate target. False for self-contained marks.

  confidence:  0.0–1.0. Lower confidence on hard-to-read handwriting is encouraged. Skip a
               mark only if you genuinely cannot tell it exists.

Output STRICT JSON matching the schema. No prose, no markdown, no code fences.
"""
