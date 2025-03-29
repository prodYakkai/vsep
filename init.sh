set -e

# Pull latest changes from main
git pull origin main

# Install npm dependencies in root
npm install

# Install npm dependencies in ./src/static
pushd ./src/static
npm install
popd

# Build project
npm run build

# Check if Redis is listening
if ! nc -z localhost 6379; then
    echo "Redis is not running or not listening on port 6379."
    kill $NODE_PID
    exit 1
fi

echo "All steps completed successfully."
