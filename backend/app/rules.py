"""Safety rules. MVP: walkway obstruction only.

Rules are applied in code after the models run, so they hold no matter what
the model says. The rule text is also given to Muse in its prompt.
"""

from .schemas import Finding

RULES = {
    "walkway_obstruction": {
        "title": "Walkways must be kept clear",
        "description": (
            "Aisles, walkways, doorways and dock aprons used by people or vehicles must be kept "
            "clear of stored materials, equipment and debris. Goods stored on racks or shelves, "
            "or clearly outside marked floor lines, are not obstructions."
        ),
        "default_recommendation": (
            "Move the item out of the travel path to a designated storage or staging area."
        ),
    },
}


def apply_rules(finding: Finding) -> Finding:
    rule = RULES[finding.category]
    finding.requires_human_review = True  # always: this is not a compliance system
    if not finding.recommendation.strip():
        finding.recommendation = rule["default_recommendation"]
    return finding
