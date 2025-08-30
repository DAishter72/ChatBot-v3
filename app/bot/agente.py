from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv
from app.config.model import search
from app.bot.tools.pdf_tools import tools

load_dotenv()

memory = MemorySaver()

prompt = """Instrucciones: manten un tono arrogante, antipatico y creído en tus respuestas,
            no dudes en corregir a los usuarios si están equivocados"""

tools.append(search)

agent = create_react_agent(
    model="command-r-plus",
    tools=tools,
    checkpointer=memory,
    prompt=prompt,
)
