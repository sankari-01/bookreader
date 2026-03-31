import re

class FreeImageExplainer:
    """
    A 'Free AI' alternative that generates professional image explanations
    without requiring an API key, using OCR results and pattern matching.
    """
    
    PATTERNS = {
        "cloud_computing": {
            "keywords": ["cloud", "server", "computing", "architecture", "network", "virtual", "router", "switch", "topology", "lan", "wan"],
            "description": "This technical illustration depicts a modern Cloud Computing architecture and network topology. It visualizes the complex ecosystem of virtualized servers, data storage, and networking layers—including routers and switches—that enable scalable and resilient digital infrastructure."
        },
        "business_growth": {
            "keywords": ["growth", "sales", "revenue", "profit", "chart", "graph", "upward"],
            "description": "This analytical graphic displays business performance metrics and growth trajectories. It highlights key strategic indicators and success markers, providing a visual representation of progressive development and fiscal health within the organization's current operational cycle."
        },
        "teamwork": {
            "keywords": ["team", "collaboration", "meeting", "people", "group", "work"],
            "description": "This visual captures a scene of professional collaboration and teamwork. It emphasizes the importance of collective problem-solving and communicative synergy, illustrating how diverse perspectives work together to achieve shared goals and project milestones."
        },
        "technology": {
            "keywords": ["ai", "digital", "data", "code", "software", "tech", "laptop", "mobile"],
            "description": "This technological visualization represents the integration of digital tools and data systems. It explores the intersection of human interaction and advanced software solutions, highlighting the efficiency and innovation driving modern technological advancements."
        },
        "nature": {
            "keywords": ["forest", "tree", "river", "mountain", "nature", "green", "earth"],
            "description": "This environmental photograph captures the serene beauty of the natural world. It illustrates ecological diversity and landscape harmony, serving to ground the document's themes in the fundamental importance of sustainability and environmental awareness."
        }
    }

    @classmethod
    def explain(cls, ocr_text):
        if not ocr_text or len(ocr_text.strip()) < 3:
            return "This image appears to be a graphical illustration or abstract visual element designed to enhance the document's aesthetic appeal and reinforce the key conceptual themes discussed in this specific section of the book."

        words = ocr_text.lower()
        
        # Check for matching domains
        for domain, data in cls.PATTERNS.items():
            if any(keyword in words for keyword in data["keywords"]):
                return data["description"]
        
        # Generic professional fallback if no pattern matches but text exists
        return (
            f"This informative visual focuses on the subject of '{ocr_text[:30].strip()}...' and its related components. "
            "It serves as a critical reference point, helping readers visualize the complex relationships and "
            "detailed information presented in the surrounding text for better comprehension."
        )
