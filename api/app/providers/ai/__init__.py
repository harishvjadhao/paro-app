from app.providers.ai.azure import (
    AzureChatProvider,
    AzureEmbeddingsProvider,
    AzureVisionOCRProvider,
)


def get_chat_provider() -> AzureChatProvider:
    return AzureChatProvider()


def get_embeddings_provider() -> AzureEmbeddingsProvider:
    return AzureEmbeddingsProvider()


def get_vision_provider() -> AzureVisionOCRProvider:
    return AzureVisionOCRProvider()
