# The Forgotten Dungeon - A fgsh Adventure Game

This is a text adventure game written in fgshell that showcases the seamless integration of JavaScript and shell commands.

## How to Run

```bash
# Method 1: Interactive mode
./fgsh
> source adventure.fgsh

# Method 2: Direct script
./fgsh adventure.fgsh

# Method 3: With bun
bun src/fgshell.js adventure.fgsh
```

## About the Game

The game demonstrates fgsh's unique capability: **mixing JavaScript logic with shell presentation**.

### Shell Commands Used
- `echo` - Display formatted UI with Unicode box-drawing characters
- `js` - Execute complex game logic entirely in JavaScript

### JavaScript Features Showcased
- Game state management (player health, inventory, gold)
- Room definitions with descriptions
- Encounter system with random combat
- Inventory management
- Conditional logic for game ending

## Example Gameplay

```
╔═══════════════════════════════════════════════════════════╗
║                 THE FORGOTTEN DUNGEON                     ║
║              A Text Adventure Game in fgsh                ║
╚═══════════════════════════════════════════════════════════╝

You wake up in darkness. A rusty key is in your pocket...

╔═══════════════════════════════════════════════════════════╗
║ Dark Entrance                                              ║
╚═══════════════════════════════════════════════════════════╝

You stand at the entrance of an ancient dungeon...

💚 Health: 100/100  💰 Gold: 0

→ You venture deeper...

╔═══════════════════════════════════════════════════════════╗
║ Long Hallway                                               ║
╚═══════════════════════════════════════════════════════════╝

⚠️  DANGER! You encounter a monster!
You take 18 damage!

✨ You found 62 gold!

[... continues through multiple rooms ...]

╔═══════════════════════════════════════════════════════════╗
║                     ADVENTURE SUMMARY                     ║
╚═══════════════════════════════════════════════════════════╝

Final Health: 47/100
Gold: 125
Inventory: rusty_key,torch,crown,gold_coins

🏆 SUCCESS! You conquered the dungeon and found great treasure!
```

## Why This Matters

This game showcases that fgsh is not just a shell—it's a **JavaScript-native platform for scripting**:

1. **Complex logic in JavaScript**: Game loops, data structures, algorithms
2. **Beautiful UI from shell**: Unicode formatting, conditional output
3. **Seamless integration**: No friction between shell and JavaScript

This is exactly what makes fgsh unique compared to bash/zsh. Developers can use their favorite language (JavaScript) for logic while keeping shell's simplicity for I/O.

## Future Enhancements

- Interactive menu system using fgsh's Ctrl+R history picker
- Saved game state using JavaScript file I/O
- Procedurally generated dungeons
- Multiple character classes with different abilities
- Multiplayer mode (not yet implemented)
