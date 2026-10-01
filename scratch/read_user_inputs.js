const fs = require('fs');
const readline = require('readline');

async function getInputs() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:\\Users\\samuv\\.gemini\\antigravity-ide\\brain\\efeaa980-3bdb-4553-ac53-e3b79086ead9\\.system_generated\\logs\\transcript.jsonl')
  });

  for await (const line of rl) {
    if (line.includes('"type":"USER_INPUT"')) {
      try {
        const obj = JSON.parse(line);
        console.log(`Step ${obj.step_index}: ${obj.content.slice(0, 300).replace(/\r?\n/g, ' ')}`);
      } catch (e) {}
    }
  }
}
getInputs();
