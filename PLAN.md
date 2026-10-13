### API Setup
- NodeJs, Express, Vitest
- MVC architecture 
- Gitignore to not commit the module in node_modules

### Create the API routes
- POST Game, POST Move, GET Game
- Store Data as a JSON file in memory 
- Proper error handling / testing on edge cases

### Create UI
- React App
- Single client - clients take turns between X and O
- Explicitly simple, UI is less of a concern per the spec

### Redis 
- Run as a sidecar
- Store the JSON Game Data in Redis container
- Atomic transactions. First write wins, second write will throw a 409

### Mutliple Clients + Waiting Room
- Build on the current API and make sure they are compatible with the changes for the session token
- Concept of a waiting room, users grab a session token on app launch, they then are matched with other sessions off of that queue
- Once in a game the client will poll for the current state of the game so that their changes match what is server side

### STRETCH GOAL: Create a docker compose file 
- For the ease of spinning up locally