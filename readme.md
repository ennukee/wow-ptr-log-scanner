# wow-ptr-log-scanner

basic tool using WCL GraphQL API to get data for the ptr log data sheet made by Robydoby

steps to run locally

1. clone the .env.example file and remove the .example part so the file is just .env
2. populate the values. these are based on your WCL API access info. no, you can't use mine.
3. run `npm i` in a terminal to install axios/dotenv
4. modify the consts listed in the main.mjs file as needed (probably only need to change the encounter id)
4. run `node .\main.mjs` to run the script
5. wait for a while because i have a lot of delays to make sure the WCL API rate limiting doesn't scream at me
6. check output.json
7. copy paste it into a raw data tab in the sheet + split text to columns
8. if you can't figure out how to set up the rest of the tweaks in the sheet you probably shouldn't be trying to mess with a sheet like his

don't try to open any PRs i will not merge them