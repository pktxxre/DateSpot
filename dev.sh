#!/bin/bash
# Wrapper around expo start that notifies you when the server stops.
npx expo start "$@"
EXIT_CODE=$?
osascript -e "display notification \"Expo server stopped (exit $EXIT_CODE)\" with title \"DateSpot Dev\" sound name \"Basso\""
