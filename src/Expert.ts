import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { VectorStoreInterface } from "@langchain/core/vectorstores";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { Document } from "langchain/document";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { CHAT_PROPMPT, REPHRASE_PROMPT } from "./prompts";

type Logger = (message: string) => void;
type RetrievalChain = Awaited<ReturnType<typeof createRetrievalChain<string>>>;

type CreateExpertOptions = {
  documentPath: string;
  log: Logger;
};

type ExpertOptions = {
  vectorStore: VectorStoreInterface;
  log: Logger;
};

export class Expert {
  public static async createForLocalDocuments({
    documentPath,
    log,
  }: CreateExpertOptions) {
    const vectorStore = await createMemoryVectorStoreFromDocuments(
      documentPath,
      log
    );
    const result = new Expert({ log, vectorStore });
    await result.init();
    return result;
  }

  private readonly vectorStore: VectorStoreInterface;
  private chain: RetrievalChain | undefined;
  private readonly chatHistory: BaseMessage[] = [];

  public constructor({ vectorStore }: ExpertOptions) {
    this.vectorStore = vectorStore;
  }

  public async init(): Promise<void> {
    const llm = new ChatOllama({
      baseUrl: "http://localhost:11434",
      model: "llama3.2",
    });

    const retriever = await createHistoryAwareRetriever({
      llm,
      retriever: this.vectorStore.asRetriever(),
      rephrasePrompt: REPHRASE_PROMPT,
    });

    const combineDocsChain = await createStuffDocumentsChain({
      llm,
      prompt: CHAT_PROPMPT,
    });

    this.chain = await createRetrievalChain({ combineDocsChain, retriever });
  }

  public async message(msg: string): Promise<string> {
    if (!this.chain) {
      throw new Error();
    }

    const response = await this.chain.invoke({
      input: msg,
      chat_history: this.chatHistory,
    });

    this.chatHistory.push(
      new HumanMessage(msg),
      new AIMessage(response.answer)
    );

    return response.answer;
  }
}

async function createMemoryVectorStoreFromDocuments(
  documentPath: string,
  log: Logger
): Promise<VectorStoreInterface> {
  const documents = await loadDocuments(documentPath, log);
  const splitDocs = await splitDocuments(documents);
  const embeddings = new OllamaEmbeddings();
  return await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
}

async function loadDocuments(
  documentPath: string,
  log: Logger
): Promise<Document[]> {
  const files = await readdir(documentPath, {
    recursive: true,
    withFileTypes: true,
  });
  const documents = await Promise.all(
    files.map((file) => {
      if (!file.isFile() || file.isDirectory()) {
        return [];
      }

      const filePath = join(file.parentPath, file.name);

      let loader;
      switch (extname(file.name)) {
        case ".md":
          loader = new TextLoader(filePath);
          break;
        case ".pdf":
          loader = new PDFLoader(filePath);
          break;
      }

      if (!loader) {
        return [];
      }

      log(`document: ${filePath}`);
      return loader.load();
    })
  );

  return documents.flat();
}

async function splitDocuments(documents: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 500 });
  return await textSplitter.splitDocuments(documents);
}
