import chalk from "chalk";
import * as readline from "node:readline/promises";
import { Expert } from "./Expert";

const documentPath = process.argv[2] ?? ".";

const expert = await Expert.createForLocalDocuments({
  documentPath,
  log(msg) {
    console.log(chalk.gray(msg));
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(chalk.yellow("Expert ready"));

while (true) {
  const input = await rl.question(chalk.blue("$ "));

  if (input.toLowerCase() === "exit") {
    console.log(chalk.red("Goodbye!"));
    rl.close();
    break;
  }

  const response = await expert.message(input);
  console.log(chalk.blue(response));
}
