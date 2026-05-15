You are addressing reviewer feedback on an academic paper. The reviewer marked up the PDF
with annotations, and a planning pass has organized those annotations into an ordered list
of edits.

Your job: apply this plan to the LaTeX source and figure-generation code in this repository.

# Working principles

1. **Work the plan in order.** Each step is independent unless its description says
   otherwise.
2. For each `commit` step, locate the LaTeX source file the edit lives in, make the edit,
   then run `latexmk -pdf` (or `tectonic`) to confirm the paper still compiles. If it does
   not compile, revert the change and report what failed.
3. Make ONE git commit per `commit` plan step. Use the step's title as the commit subject;
   include the `source_annotation_ids` in the commit body for traceability.
4. For `pr_comment` steps, do NOT modify code. Save them for the end and surface them in
   your final summary.
5. For any step with `requires_human_confirmation=true`, STOP and ask the user to confirm
   before applying. Show your proposed fix and the reviewer's original instruction.

# Plan summary

{{ plan.summary }}

**Stats:** {{ commit_count }} commit step{{ "s" if commit_count != 1 else "" }} ·
{{ pr_count }} PR comment step{{ "s" if pr_count != 1 else "" }}{% if manual_count %}
 · {{ manual_count }} manual{% endif %}.

# Plan steps

{% for step in plan.steps %}
## {{ step.order }}. {{ step.title }}

- **Kind:** `{{ step.kind }}`
{% if step.requires_human_confirmation %}
- ⚠️ **Requires human confirmation before applying.**
{% endif %}
- **Rationale:** {{ step.rationale }}
{% if step.target_files_hint %}
- **Likely files:** {% for f in step.target_files_hint %}`{{ f }}`{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}

{{ step.description }}

### Source annotations

{% for ann in step.source_annotations %}
- **p.{{ ann.page }}** · _{{ ann.reviewer_intent or 'unclassified' }}_ · confidence {{ "%.2f"|format(ann.confidence) }}{% if ann.user_edited %} · **(user-edited)**{% endif %}
  - Instruction: {{ ann.intent }}
{% if ann.anchor_text %}
  - Refers to: `{{ ann.anchor_text }}`
{% endif %}
{% if ann.annotation_content %}
  - Handwriting: `{{ ann.annotation_content }}`
{% endif %}
{% if ann.context_text %}
  - Context: {{ ann.context_text }}
{% endif %}
{% endfor %}

{% endfor %}

# Annotations NOT in the plan

These annotations were not assigned to a plan step. Review them manually after applying
the plan.

{% if unplanned_annotations %}
{% for ann in unplanned_annotations %}
- **p.{{ ann.page }}** · _{{ ann.reviewer_intent or 'unclassified' }}_: {{ ann.intent }}{% if ann.anchor_text %} (re: `{{ ann.anchor_text }}`){% endif %}
{% endfor %}
{% else %}
_None — every annotation is covered by the plan._
{% endif %}

# When you're done

Print a summary of:
- What you committed (one line per commit).
- Any `pr_comment` items the author should see.
- Anything you SKIPPED and why.
- Anything that failed to compile.
