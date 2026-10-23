import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";

export class Prompt {
  private readonly readline: Interface;
  private readonly lines: AsyncIterator<string>;

  constructor() {
    this.readline = createInterface({ input, output, terminal: Boolean(input.isTTY) });
    this.lines = this.readline[Symbol.asyncIterator]();
  }

  async ask(question: string, isValid: (value: string) => boolean = () => true, hint = ""): Promise<string> {
    for (;;) {
      output.write(question);
      const line = await this.lines.next();
      if (line.done) throw new Error("Input closed before an answer was given.");

      const answer = String(line.value).trim();
      if (!input.isTTY) output.write(`${answer}\n`);
      if (isValid(answer)) return answer;
      if (hint) console.log(`  ${hint}`);
    }
  }

  async confirm(question: string, defaultYes = true): Promise<boolean> {
    const answer = await this.ask(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `, (value) =>
      /^(y|yes|n|no|)$/i.test(value),
    );
    return answer === "" ? defaultYes : /^y/i.test(answer);
  }

  close(): void {
    this.readline.close();
  }
}
