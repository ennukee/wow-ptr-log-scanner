import fs from 'fs';
import csv from 'csv-parser';
import { stringify } from 'csv-stringify';

// Tool used to help dedupe output data from WCL, commonl
// in the case of several people logging the same fight.

const results = [];
const FILEPATH = './output/output_3134_4.json'
fs.createReadStream(FILEPATH)
  .pipe(csv({ headers: false }))
  .on('data', (data) => results.push(Object.values(data)))
  .on('end', () => {
    console.log(results.length)
    const dedupedResults = results.filter((result, index, self) => 
      index === self.findIndex((t) => 
        t[1] === result[1] && t[4] === result[4] && (Math.abs(t[3] - result[3]) / ((t[3] + result[3]) / 2) <= 0.002)
      )
  );
  console.log(dedupedResults.length)

  const outputFilePath = FILEPATH.replace('.json', '_deduped.json');
  const output = fs.createWriteStream(outputFilePath);
  const stringifier = stringify({ header: false });

  dedupedResults.forEach(row => {
    stringifier.write(row);
  });

  stringifier.pipe(output);
  stringifier.end();
});
