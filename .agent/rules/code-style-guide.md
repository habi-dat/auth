---
trigger: always_on
---

# Code style guide

- always use cli commands when bootstraping code (like create a nextjs app) to have to most recent version
- if you run into linting or type problems always look up the docs of the tools in the web
- always lookup similiar implementations in the code base to keep consistent
- keep files and components short 
- create reusable code
- reuse existing types or derive types from existing types or schemas, like return types or generated prisma types. 
- store types and schemas centrally
- use kebap case for file names
- use camel case for function names
- use capital camel case for component names
- always create translation keys for texts (only create en.json texts)
- use server actions with next-safe-action for everything (also data fetching)
- always use implicit types where possible, especially reuse the types from prisma
- create generic components to reuse (e.g. a generic table component with parametrized bulk actions and row actions)
- whenever necessary look into the old implementation in the old folder
- ALWAYS search online for solutions and tutorials, especially if you get stuck with and type or linting error