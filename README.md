### Repo Location: https://github.com/reedhop24-del/openhands-tic-tac-toe
### Screen recording: https://www.youtube.com/watch?v=f4aVNm2p6-Q

## How to run the app and the tests

### Prereqs:
- node v20.20.2
- podman

### Manual Test

#### Run the Redis host:
- `podman machine start`
- `podman pull docker.io/library/redis:7`
- `podman run -d --name tic-tac-toe-redis -p 6379:6379 docker.io/library/redis:7`

#### Run the App:
- `cd service`
- `npm run start`

#### Run the UI:
- `cd ui`
- `npm run dev`

#### Steps to test
- Open up 2 different tabs each navigated to http://localhost:5174/
- See each client send request for a session and to join waiting room
- After no more than 5 seconds each client will join the same game
- Play a round of tic tac toe between the clients
- Verify the correct client is displayed as the winner and that the game is over

## Your design: how the backend models the game, and why
If you think about a physical tic tac toe game, there are two different things you draw on the paper: a board and moves on the board. Therefore the 
base of the API is just this. So in the first phase while building the base requirements: a POST /games creates a game then moves are done on POST /games/{gameId}/moves. The move API will return a game result as soon as the board reflects a win or draw, this is also how game play works in the real world. I wanted to follow good REST convention while also modeling real world play. 

The server is the source of truth. The state of the game can be received through GET /games/{gameId} which will return the board. The board is very simply
a length 9 array ie: ["X",null,"X","O","X","O","O",null,null]. Moves are stored as a versioned snapshot, storing the state of the board and who moved last. Each move is also validated, the key criteria for each move is:
1. Is it the current players turn?
2. Is this spot on the board currently taken? 
3. Is the game still in progress? 
4. Is the space the user is trying to move valid within the 0-8 idx of the board?
The result of the game is also determined server side so the client does not have to do any translation from the board state to result. 

## What you chose to build beyond the requirements, and why
### Redis
Within the base requirements I was just storing the tic tac toe data in memory. The logical next step was to store this data somewhere outside of Node so a server restart would persist the data. Redis was a good fit for a couple of reasons:
1. Flexibility, I could use whichever type fit each need without defining a schema: list for the FIFO session queue, JSON strings for games and versions, and a simple key value pair for session to game lookup.
2. There is not a complex relational mapping between entities so no need for complex querying. Using a SQL DB would be overkill as the complex querying offered would be underutlized. 
3. Rather than go with DynamoDB or something AWS native that would require this to run a localstack container and manage AWS resources, instead I just pull the redis container and start writing which was really easy during development.
4. Redis also provides optimistic locks through `WATCH`, `MULTI`, and `EXEC`. Since write contention is rare, I wanted optimistic locks rather than having to use a pessimistic lock. 

### Matchmaking queue and worker
The second thing I chose to build was making this all multi client. In the initial requirements users would take turns between X and O from the same client. I thought the best way to make this multiplayer would be through a matchmaking process and a waiting room. The client fetches a session token, their session token is then put on a FIFO queue. The main NodeJs app spins up a child process which grabs the oldest 2 tokens in the queue and creates a game with them. The client then is polling for their session token until a game is available. Since the game now has moves coming from 2 different clients, each client is polling the GET games endpoint to see moves the other player has made. 

This async worker + queue worked well with the APIs I had built in previous steps. It seemed like an extension on the work up until this point rather than a rewrite. I chose this as I thought it would highlight a lof of the real world engineering I have done. Things are often asynchronous so how we handle those async processes while taking into account UX is something I enjoy. It also was a great opportunity to highlight the native FIFO queue that is afforded with redis.  

## Which AI tools you used and how

I used Claude through the Claude desktop app (Cowork mode). The AI wrote and edited the code in my repo but never executed it, so I reviewed every change and ran the tests and manual checks myself to make sure I knew exacly what was being shipped. I wrote a system prompt to persist the agent's role, tone, contstraints, and output format through the session. My system prompt also specified for the AI to write robust tests, I wanted Claude to cover all of the gaps I may have missed as far as edge cases go. Though I still had in my mind what the edge cases were, so I was able to verify the tests against the mental map of edge cases I had. I also specified that claude never change the API contract without explicit direction from me. This way we would never introduce any sort of regression. I also had a specific idea of what that contract should look like and I didn't want any guess work from the AI. The structured outputs also included any tests manual or automated that were added or modified. It was helpful to have claude generate cli commands so I could manually verify against it's work. 

From a prompt standpoint I made sure that each prompt had a tangible success criteria. I also used Claude and prompted for investigation, when I was unsure about serialization vs Redis' native JSON type I leaned on Claude to give me the pros and cons of each. I knew that I needed to handle ATOMIC transactions in Redis so I again relied on Claude lay out my different options. I then probed more when it gave me a suggestion and ultimately made the decision against the suggested Lua script. 

## What didn't go as planned, or what you'd improve with more time (in your own words, please, not AI's)

### Not as planned
I deviated from my goals in a couple of different ways:
- Ended up not saving games and versions as a JSON object. Felt easier to just do an in memory map which I was moving to Redis anyhow so not a big deal.
- Just used node's test runner rather than vitest, since the testing was simple enough I didn’t push back on Claudes decision there. 
- The child matchmaking worker does not work how I intended, the worker currenly spins up every 5 seconds and creates only 1 game. If this were going to be released to production with many different clients, this would break. Users would be sitting in the queue for way too long. I just failed to prompt Claude to clear the queue on every run of the child process. It should run the same logic of grabbing the front of the queue but do it in a loop so the queue gets emptied. This would be a pretty simple fix. 

#### Improve with more time
- One of the stated goals was a docker compose, I think since redis is running as a separate container this would be pretty necessary for spinning up the entire app more easily
- Currently we are polling in a couple of different places. It would be nice to instead make use of Websockets. Instead of continually asking the server if a new game exists for the session, a WS server could push messages down. Same thing with the poll for the board, a WS server could send the new board down to the client and let them know it is their turn.
- The worker also could be a long lived worker instead of spinning up every 5 seconds and going back down. I wanted to do a timed child process because I wanted some delay to mimic how a waiting room usually works for most games. If this were a production system, a dedicated and long lived worker would be implemented. 

