import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

export const REPHRASE_PROMPT = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
  [
    "user",
    "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
  ],
]);

export const CHAT_PROPMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are given a user question, chat history, some textual context and rules. You have to answer the question based on the context while respecting the rules.

Rules:
- If you don't know, just say so.
- If you are not sure, ask for clarification.
- Answer in the same language as the user query.
- If the context appears unreadable or of poor quality, tell the user then answer as best as you can.
- If the answer is not in the context but you think you know the answer, explain that to the user then answer with your own knowledge.
- Answer directly and without using xml tags.

Context:
{context}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);
