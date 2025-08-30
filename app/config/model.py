from langchain_tavily import TavilySearch
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv

load_dotenv()

model = init_chat_model("command-r-plus", model_provider="cohere")

search = TavilySearch(
    max_results=5
)
