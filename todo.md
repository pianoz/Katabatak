Building a web-hosted RPG is a massive undertaking, and keeping the backend logic clean while juggling content is half the battle. Here is your Katabatk development roadmap, organized by technical focus so you can tackle related systems together.

Backend & Game Management
[ ] Fix Game Deletion Dependencies: Update the delete logic for archived games. Implement a cascade delete through the game_members relational table, ensuring actual character records are strictly preserved when a game is removed.

[ ] Overhaul Character Invites: Allow characters to be re-invited to games (handling multiple invites). Implement cleanup logic on the relational table so pending invites are automatically deleted upon an "Accept" or "Decline" action.

[ ] Edit Game Settings: Build the UI and endpoint to allow players to change the game's name after creation.

Core Engine & Mechanics
[ ] Wire Up the Skill Engine: Connect the core skill system to the rest of the game architecture and run end-to-end functionality tests.

[ ] Fix the "Rest" Button: Update the resting logic so characters regain exactly 6 points to each pool base. Ensure this calculation properly hooks into modifiers from the newly wired skill engine.

[ ] Implement Body-Part Loadouts: Add an armor and equipment section where players can equip specific armor pieces to distinct locations on their character's body.

[ ] Build Crafting Mechanic: Implement the custom crafting system you've mapped out.

Content & Data Revisions
[ ] Finalize the Skill Tree: Lock in the final design, hierarchy, and node connections for character skills.

[ ] Revise Items: Audit all in-game items and assign concrete attack and defense stats to applicable gear.

[ ] Revise Creatures: Update all creature stat blocks to include their actual attack and defense values.

[ ] Revise Spells: Audit the existing magic system and integrate the core "basic" spells into the database.