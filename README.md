## About

VSEP - very simple embedded player

## Available Scripts


### `npm run dev` or `npm run dev:hot` (hot reloading)

Run the server in development mode.<br/>

**IMPORTANT** development mode uses `swc` for performance reasons which DOES NOT check for typescript errors. Run `npm run type-check` to check for type errors. NOTE: you should use your IDE to prevent most type errors.

### `npm run build`

Build the project for production.


### `npm start`

Run the production build (Must be built first).


## Additional Notes

- If `npm run dev` gives you issues with bcrypt on MacOS you may need to run: `npm rebuild bcrypt --build-from-source`.
- Remember to install `src/static/`'s package with npm. 


## Deployment

### Windows

- Install Redis Windows [Install](https://github.com/redis-windows/redis-windows)
- Install Node.js [Install](https://nodejs.org/en/download/)
