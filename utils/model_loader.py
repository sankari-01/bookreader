from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, AutoModelForQuestionAnswering, pipeline

class AIModels:
    _summarizer_model = None
    _summarizer_tokenizer = None
    _qa_model = None
    _qa_tokenizer = None
    _transcriber = None

    @classmethod
    def get_summarizer(cls):
        if cls._summarizer_model is None:
            # Using a lightweight model for speed and compatibility
            model_name = "sshleifer/distilbart-cnn-12-6"
            cls._summarizer_tokenizer = AutoTokenizer.from_pretrained(model_name)
            cls._summarizer_model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        return cls._summarizer_model, cls._summarizer_tokenizer

    @classmethod
    def get_qa(cls):
        if cls._qa_model is None:
            # Reliable QA model
            model_name = "deepset/roberta-base-squad2"
            cls._qa_tokenizer = AutoTokenizer.from_pretrained(model_name)
            cls._qa_model = AutoModelForQuestionAnswering.from_pretrained(model_name)
        return cls._qa_model, cls._qa_tokenizer

    @classmethod
    def get_transcriber(cls):
        if getattr(cls, '_transcriber', None) is None:
            # Using Whisper for transcription
            cls._transcriber = pipeline("automatic-speech-recognition", model="openai/whisper-tiny")
        return getattr(cls, '_transcriber', None)
