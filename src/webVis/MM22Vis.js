/*
    Author: Michael Rechenberg

    Phaser Visualizer code for mm22

    This will draw the sprites for each of the characters using
    the JSON from the server (however we decide to send it) and
    any spells casted by any players.
    The server is responsible for making sure the movements are valid.

    Assumes that there are 6 players total (3 on each team)

    A good reference for Phaser things: https://leanpub.com/html5shootemupinanafternoon/read
    Phaser website: http://phaser.io/

    The execution of Phaser functions is as follows:

        preload()
        create()
        update()
        render()

    preload() and create() only run once, while update() and render()
    run every frame
    render() is usually not needed, but is good for debugging
    For this MechMania, the visualizer is updated every TIME_TO_NEXT_UPDATE milliseconds:
        this is done by adding all of the functions that update the visualizer to Phaser's
        internal clock and having the functions be called after TIME_TO_NEXT_UPDATE 
        milliseconds have elapsed

    The server will send a lot of JSON, but it will be added
     to a queue and the front element will be dequeued every
     time the turn is displayed onto the screen, as determined by
     TIME_TO_NEXT_UPDATE.

    
    TODO: Keep track of Asset Lists
    TODO: Figure out how the movement system will be translated
        into the JSON, a.k.a what calculation has to be done by the
        visualizer (Jack, Eric, Asaf)
    TODO: Create queue for JSON to be parsed
    TODO: Remove any dummy data/variables/JSON
	TODO: Have updateSinglePlayerStats and updateMultiPlayerStats
		so that instead of random data it uses serverJSON


    -----MAP----
    A 5x5 configuration with 120x120 pixel spaces for "quadrants"
    Each quadrant has a 3x3 configuration, with each element 
        a 40x40 pixel space
    Characters will be placed within each quadrant such that
        all 6 characters can fit in one quadrant at one time

    x ----->
    y 
    |
    |
    V

    ----/MAP----

    What Will Happen For Every Bit Of JSON
        Update Stats Screen Data
        Move Characters
            Have each character fit in the next "quadrant"
                Can characters move w/in a quadrant???
        Add any spells/actions to the spells group w/ addSpell()
        Release any of the spells with releaseSpells()


*/

//----------Constants and Global Variables------------//



function WebSocketTest()
         {
            if ("WebSocket" in window)
            {
               alert("WebSocket is supported by your Browser!");
               
               // Let us open a web socket
               var ws = new WebSocket("ws://localhost:8080/");
                
               ws.onopen = function()
               {
                  // Web Socket is connected, send data using send()
                  ws.send("Message to send");
                  alert("Message is sent...");
               };
                
               ws.onmessage = function (evt) 
               { 
                // TODO: Implement updates
                // This is the important function

                  var received_msg = evt.data;
                  alert("Message is received...");

                  console.log(received_msg);
                  //TODO: Should this enqueue rather than assign?
                  serverJSON = received_msg; // JSON.parse
                  // update everything
               };
                
               ws.onclose = function()
               { 
                  // websocket is closed.
                  alert("Connection is closed..."); 
               };
            }
            
            else
            {
               // The browser doesn't support WebSocket
               alert("Game NOT supported by your Browser!");
            }
         }

//Queue containing all the JSON from the server
var serverJSON = [];


//Number of milliseconds until the next bit of JSON will be processed
//  and the visualizer is updated
var TIME_TO_NEXT_UPDATE = 2000;

//Number of milliseconds allowed for each spell to be tweened
//  i.e. to move from caster to target 
var TIME_FOR_SPELLS = 500;



//Constants to define Phaser's width and height

//Width of the game, where sprites will be drawn
var GAME_WIDTH = 600;
//Height of the game
var GAME_HEIGHT = 600;
//Width of the space where to display the stats of each player
var STAT_WIDTH = 400;


//Constant to define the x and y coords of any sprite we load
//  but don't want to be visible
var OFF_SCREEN = -500;


//Reference to the core game object
//If you want to use game.debug in the render() function, you need to set
//  Phaser.AUTO to Phaser.CANVAS (the renderer)
//The width is 1000 pixels (GAME_WIDTH + STATWIDTH) and the height is 
//  600 pixels (GAME_HEIGHT)
var game = new Phaser.Game(GAME_WIDTH + STAT_WIDTH, GAME_HEIGHT, Phaser.AUTO,
 'phaser-game', { preload: preload, create: create, update: update});


//Reference to the game's timer
var timer;

// These Graphics Objects are used to draw Health Bars (drawRect)
// Graphics Object for Single Player Stat Screen
var singleGraphics;
// Graphics Object for MultiPlayer Stat Screen
var multiGraphics;


//width and height of a character's sprite, in pixels
var CHARACTER_DIMENSION = 40;

//width and height of a quadrant, in pixels
//The each quadrant is accessed by multiplying QUADRANT_DIMENSION  
//  by 0, 1, 2, 3, or 4
var QUADRANT_DIMENSION = 120;





//Group containing all of the characters we want to use
var characters;

//Arrays that hold the players on each team
var teamA = [];
var teamB = [];



//Group containing all the spells to be cast on one turn
var spells;



//Object to contain all of the handles to Phaser text objects 
//  and other things relevant to the stats screen
var statScreen = {
    //If true, display all the character's stats
    //If false, only display the stats of "CharacterName"
    "ShowAll" : false,
    "SinglePlayer" : {
        //Holds the string of the character's name that is being tracked
        "CharacterNameString" : null,
        //Handle to the Text Object containing the tracked character's name
        "CharacterName" : null,
        //Handles to the Phaser.Text Objects of each attribute
        //Use this object if we are tracking only one characer
        "AttributeStrings" : {
            "Damage" : null,
            "AbilityPower" : null,
            "AttackRange" : null,
            "AttackSpeed" : null,
            "Armor" : null,
            "MovementSpeed" : null
        },
        //Contains handles to the rectangle and Text object representing
        //  The health bar
        "HealthBar" : {
            "Bar" : null,
            "HealthText" : null,
            "HEALTH_BAR_X" : GAME_WIDTH + 10,
        }
    },
    //Contains All the players, in order
    "MultiPlayer" : [
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            //Contains initial value for each stat
            //Used for coloring each abbreviation correctly
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            //Handle to the Rect Object indicating the player's health
            "HealthBar" : null,
        },
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            "HealthBar" : null
        },
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            "HealthBar" : null
        },
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            "HealthBar" : null
        },
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            "HealthBar" : null
        },
        {
            "Sprite" : null,
            //Handle to the Text Object containing the tracked character's name
            "CharacterName" : null,
            //Handles to the Phaser.Text Objects of each attribute
            //Use this object if we are tracking only one characer
            "AttributeStrings" : {
                "Damage" : null,
                "AbilityPower" : null,
                "AttackRange" : null,
                "AttackSpeed" : null,
                "Armor" : null,
                "MovementSpeed" : null
            },
            "InitialValue" : {
                "Damage" : -1,
                "AbilityPower" : -1,
                "AttackRange" : -1,
                "AttackSpeed" : -1,
                "Armor" : -1,
                "MovementSpeed" : -1,
             },
            "HealthBar" : null
        },
    ]

};


//constant of Y-position of where the text of attributes will be positioned
//  relative to this coordinate
var ATTRIBUTE_STRINGS_Y = 300;

//dummyJSON for testing
var dummyPlayer = {
    "stats" : {
            "Health"        : 500,
            "Damage"        : 50,
            "AbilityPower" : 50,
            "AttackRange"   : 5,
            "AttackSpeed"   : 2,
            "Armor"         : 10,
            "MovementSpeed" : 5,
            "Abilities"     : [ 1 ]
    }

};


//Handles to the Text objects that will act like buttons to switch
//  between the single player and multi-player overlay
var multiButton;
var singleButton;


//Color Constants
//Default Color for strings (orange-ish)
var DEF_COLOR = "#ffa366"

//Health Bar Constants
var HEALTH_BAR_COLOR = 0x33CC33;




//------------Main Phaser Code---------------//

//load our assets
function preload () {
    //background image
    game.load.image('background', 'assets/grid-background.jpg');

    //TODO: add code so each player has the sprite corresponding to 
    //  their class
    //sprites for the characters
    game.load.image('playerOne', 'assets/star40x40.png');
    game.load.image('playerTwo', 'assets/dude1-40x40.png');
    game.load.image('playerThree', 'assets/dude2-40x40.png');
    game.load.image('playerFour', 'assets/star40x40.png');
    game.load.image('playerFive', 'assets/dude1-40x40.png');
    game.load.image('playerSix', 'assets/dude2-40x40.png')
    game.load.image('spell1', 'assets/spell1.png');
    
    //log success
    console.log("preload() complete");
}

/**
    Add the assets to the game and make them visible
    Initate any functions to be called on a looping schedule
*/
function create () {
    //enable physics, so far not necessary
    //game.physics.startSystem(Phaser.Physics.ARCADE);

    // //tests queue system
    // //TODO: Delete these 2 lines
    populateQueue();

    //set background image
    var background = game.add.sprite(0, 0, 'background');

    //create group for spells
    spells = game.add.group();

    //create group for characters
    characters = game.add.group();
    //Add all players to the characters group at their initial locations
    //TODO: add all characters to their intitial locations according to JSON
    //TODO: Let participants choose names for their character???
    statScreen["MultiPlayer"][0].Sprite = characters.create(2 * QUADRANT_DIMENSION, 1 * QUADRANT_DIMENSION, 'playerOne');
    statScreen["MultiPlayer"][0].Sprite.name = "player One";
    statScreen["MultiPlayer"][1].Sprite = characters.create(3 * QUADRANT_DIMENSION, 1 * QUADRANT_DIMENSION, 'playerTwo');
    statScreen["MultiPlayer"][1].Sprite.name = "player Two";
    statScreen["MultiPlayer"][2].Sprite = characters.create(2* QUADRANT_DIMENSION, 2*QUADRANT_DIMENSION, 'playerThree');
    statScreen["MultiPlayer"][2].Sprite.name = "player Three";
    statScreen["MultiPlayer"][3].Sprite = characters.create(3* QUADRANT_DIMENSION, 3*QUADRANT_DIMENSION, 'playerFour');
    statScreen["MultiPlayer"][3].Sprite.name = "player Four";
    statScreen["MultiPlayer"][4].Sprite = characters.create(4* QUADRANT_DIMENSION, 2*QUADRANT_DIMENSION, 'playerFive');
    statScreen["MultiPlayer"][4].Sprite.name = "player Five";
    statScreen["MultiPlayer"][5].Sprite = characters.create(3* QUADRANT_DIMENSION, 2*QUADRANT_DIMENSION, 'playerSix');
    statScreen["MultiPlayer"][5].Sprite.name = "player Six";

    //TODO: Code to add each player to teamA or teamB, use the JSON




    //enable input for all character sprites
    characters.setAll('inputEnabled', true);
    //When input is detected (currently only clicking on a sprite is detected)
    // changeStatScreen is called by the sprite's corresponding player variable
    //Pass the variable of the calling character sprite to
    // changeStatScreen() 
    characters.callAll('events.onInputDown.add', 'events.onInputDown', 
        changeStatScreen, this);

    //Have the timer call all of the following functions every
    //  TIME_TO_NEXT_UPDATE milliseconds
    //This function will only update the screen if serverJSON has 
    //  data within it (we aren't waiting for the server to send JSON over)
    game.time.events.loop(TIME_TO_NEXT_UPDATE, updateStatScreen, this);

    //add Graphics Object to the Game (used for drawing primitive shapes--health bars)
    singleGraphics = game.add.graphics();
    multiGraphics = game.add.graphics();

    //TODO: Decide if we want to start with multiplayer or single player overlay
    //draw the Single Player Stat Screen
    //Inits with 
    initSinglePlayerStatScreen(statScreen["MultiPlayer"][0].Sprite);
    killSinglePlayerStatScreen();
    initMultiPlayerStatScreen();

    multiButton = game.add.text(GAME_WIDTH+250, 550, "MULTI", {font: "4em Arial", fill: "#ff944d"});
    multiButton.inputEnabled = true;
    multiButton.events.onInputDown.add(reviveMultiPlayerStatScreen, this);

    singleButton = game.add.text(GAME_WIDTH+20, 550, "SINGLE", {font: "4em Arial", fill: "#ff944d"});
    singleButton.inputEnabled = true;
    singleButton.events.onInputDown.add(reviveSinglePlayerScreen, this);


    //log success
    console.log("create() complete");
}

//called every frame, roughly 60 frames per second
//this is unnecessary
function update () {


    //Adds callback to event listener for clicking
    //Uncomment this if you want to move one step at a time with a mouse click
    //game.input.onTap.add(moveCharactersQuadrantAbsolute, this);

    // //Uncomment this if you want to move the characters by pushing the up arrow
    // if(game.input.keyboard.isDown(Phaser.Keyboard.UP)){
    //     //moveCharacters();
    //     moveCharactersQuadrant();
    // }

}


//-------------END OF MAIN PHASER CODE-------------------//

















//--------------CODE FOR ACTIONS/SPELLS-------------------//



//List to keep track of caster and target of spells
var spellList = [];


/*
    Adds a spell to the spells group.
    Call releaseSpells() to move all the spell sprites
        to their respective targets.
    If you want a spell to target the caster (self-heal, 
        self-buff), just set caster and target to the
        same value.

    caster--the sprite of the character casting the spell
    target--the sprite of the charcter targetted by the spell
    spellName--string of the key denoting the sprite of a 
        certain spell.
*/
function addSpell(caster, target, spellName){
    //add the spell sprite to the spells group
    //  and add the corresponding spell's sprite 
    //  to the caster's current position
    spells.create(caster.x, caster.y, spellName);
    //add the caster and target to the spellList array
    spellList.push({"caster" : caster, "target" : target});
}

/*
    Releases all the spells that were added by addSpell(),
    moving each spell sprite to their respective target.
    This function clears both spellList and the spells group.
*/
function releaseSpells(){
    //Go through all the spells in the spells group
    //  and tween them to their targets
    var index = spellList.length-1;
    var tween;
    while(index >= 0){
        //get the child, starting at the end of the group
        //  and moving towards the first element
        var currentSpell = spells.getChildAt(index);
        //moves the spell on the screen, takes TIME_FOR_SPELLS amount of milliseconds
        tween = game.add.tween(currentSpell).to({x: spellList[index].target.x + 10, 
            y: spellList[index].target.y + 10}, TIME_FOR_SPELLS, null, true);
        index--;
    }
    
    //cleanup
    spellList = [];
    tween.onComplete.add(function(){
        spells.removeAll(true, false);
    }, 
    this);
    
}







//----------------Code for Movemement---------------//



//Dummy JSON to test moveCharactersQuadrant()
//number of quadrants to move in the x or y direction
var dummyMovement = {
    "playerOne" : 
    {
        "x" : 1,
        "y" : 1
    },
    "playerTwo" : 
    {
        "x" : 0,
        "y" : 1
    },
    "playerThree" : 
    {
        "x" : 1,
        "y" : 0
    },
    "playerFour" : 
    {
        "x" : 0,
        "y" : -1
    },
    "playerFive" : 
    {
        "x" : -1,
        "y" : 0
    },
    "playerSix" : 
    {
        "x" : 0,
        "y" : 0
    }
};


//Represents the map wih a 5x5 array of "tuples"
//Each "tuple" is (row,column) that is available for
//  the next sprite to be inserted
//Access this array in the following way:
//  nextQuadrantSpaceAvailable[quadrantRow][quadrantColumn][0 or 1]
//      0 denotes a row within the quadrant
//      1 denotes a column within the quadrant
//  
//  column ---->
//  row
//   |
//   |
//   V
//

var nextQuadrantSpaceAvailable = [
    [[0,0],[0,0],[0,0],[0,0],[0,0] ],
    [[0,0],[0,0],[0,0],[0,0],[0,0] ],
    [[0,0],[0,0],[0,0],[0,0],[0,0] ],
    [[0,0],[0,0],[0,0],[0,0],[0,0] ],
    [[0,0],[0,0],[0,0],[0,0],[0,0] ],

];


/**
    Moves a character from one quadrant to another.
    
    Moves using JSON that gives displacement of each player
    in relation to their old quadrant.
        If a player has an x of 1 and y of -1, they will move
        one box to the right and up one box.


    If multiple characters are in the same quadrant,
      space them out so each character sprite can be 
      visible. 

    Each quadrant is defined to be 120x120 pixels

    NOTE: Does not check to see if the move is valid
        (does not check if the character will move off of the map,
        into a pillar)

    WARNING: This method is deprecated and needs to be refactored
      to use statScreen["MultiPlayer"].Sprite instead of playerOne,
      playerTwo, playerThree...

*/
function moveCharactersQuadrant(nextTurn){
    //TODO: Use absolute position if JSON from server gives that

    //reset nextQuadrantSpaceAvailable so all spaces are available
    for(var i = 0; i < nextQuadrantSpaceAvailable.length; i++){
        for(var j = 0; j < nextQuadrantSpaceAvailable[i].length; j++){
            nextQuadrantSpaceAvailable[i][j][0] = 0;
            nextQuadrantSpaceAvailable[i][j][1] = 0;
        } 
    }
    randomizeMovement();
    for(var k in dummyMovement){
        //marks the coordinates of where the player will be after moving
        var newQuadrantRow = 0;
        var newQuadrantCol = 0;
        switch(k){
            case "playerOne":
                //calculate the player's new destination
                newQuadrantCol = (statScreen["MultiPlayer"][0].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][0].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant at the top-left corner
                statScreen["MultiPlayer"][0].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][0].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][0].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][0].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            case "playerTwo":
                newQuadrantCol = (statScreen["MultiPlayer"][1].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][1].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant
                statScreen["MultiPlayer"][1].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][1].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][1].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][1].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            case "playerThree":
                newQuadrantCol = (statScreen["MultiPlayer"][2].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][2].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant
                statScreen["MultiPlayer"][2].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][2].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][2].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][2].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            case "playerFour":
                newQuadrantCol = (statScreen["MultiPlayer"][3].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][3].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant
                statScreen["MultiPlayer"][3].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][3].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][3].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][3].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            case "playerFive":
                newQuadrantCol = (statScreen["MultiPlayer"][4].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][4].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant
                statScreen["MultiPlayer"][4].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][4].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][4].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][4].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            case "playerSix":
                newQuadrantCol = (statScreen["MultiPlayer"][5].x + dummyMovement[k]["x"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                newQuadrantRow = (statScreen["MultiPlayer"][5].y + dummyMovement[k]["y"] * QUADRANT_DIMENSION)/QUADRANT_DIMENSION;
                //move them into the quadrant
                statScreen["MultiPlayer"][5].x += dummyMovement[k]["x"] * QUADRANT_DIMENSION;
                statScreen["MultiPlayer"][5].y += dummyMovement[k]["y"] * QUADRANT_DIMENSION;
                //move them again to the next column if they're isn't room in the quadrant
                statScreen["MultiPlayer"][5].x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
                statScreen["MultiPlayer"][5].y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
                //update the column part of the "tuple"
                nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
                //if the column is 3, move to the next row
                if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
                    nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
                }
                break;
            default:
                break;
        }
    }




}


/**
    Uses assignment from the JSON rather than a +=, so use this if
    the JSON gives ABSOLUTE position rather than relative displacement
*/
function moveCharactersQuadrantAbsolute(){

   //reset nextQuadrantSpaceAvailable so all spaces are available
    for(var i = 0; i < nextQuadrantSpaceAvailable.length; i++){
        for(var j = 0; j < nextQuadrantSpaceAvailable[i].length; j++){
            nextQuadrantSpaceAvailable[i][j][0] = 0;
            nextQuadrantSpaceAvailable[i][j][1] = 0;
        } 
    }
   
    //TODO: Delete this line in production, used for testing for now
    randomizeMovement();

    //have the sprites move to a random location (x,y) = ((0-4),(0-4))
    var index = 0;
    for( k in dummyMovement ){
        //marks the coordinates of where the player will be after moving
        var newQuadrantRow = 0;
        var newQuadrantCol = 0;
        newQuadrantCol = dummyMovement[k]["x"];
        newQuadrantRow = dummyMovement[k]["y"];
        //move them into the quadrant at the top-left corner
        statScreen["MultiPlayer"][index].Sprite.x = dummyMovement[k]["x"] * QUADRANT_DIMENSION;
        statScreen["MultiPlayer"][index].Sprite.y = dummyMovement[k]["y"] * QUADRANT_DIMENSION;
        //move them again to the next column if they're isn't room in the quadrant
        statScreen["MultiPlayer"][index].Sprite.x += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] * CHARACTER_DIMENSION;
        statScreen["MultiPlayer"][index].Sprite.y += nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] * CHARACTER_DIMENSION;
        //update the column part of the "tuple"
        nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1]+= 1;
        //if the column is 3, move to the next row
        if(nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] === 3){
            nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][1] = 0;
            nextQuadrantSpaceAvailable[newQuadrantRow][newQuadrantCol][0] += 1;
        }
        index++;
    }

    //Add spells for testing
    //TODO: Delete this
    addSpell(statScreen["MultiPlayer"][2].Sprite, statScreen["MultiPlayer"][1].Sprite, "spell1");
    addSpell(statScreen["MultiPlayer"][1].Sprite, statScreen["MultiPlayer"][0].Sprite, "spell1");
    addSpell(statScreen["MultiPlayer"][0].Sprite, statScreen["MultiPlayer"][2].Sprite, "spell1");
    releaseSpells();
}















//-----------------Code for Stats Screen---------------------//

/**
    The Stats Screen has two states:
        1) Single Player--Shows the numerical stats of one player only
        2) Multiplayer--Shows the net change of each players' stats by
            means of a red or green string for each attribute and a health bar

    To switch between states, the user clicks on the text saying 
        "Single" or "Multi"
    When clicked, each Text Object will kill the other stat screen 
        (clicking "Single" while the Multiplayer screen is up will
        mean that the Multiplayer screen is killed and all of its 
        associated objects are no longer visible) and revive the 
        stat screen associated with its stat screen.
        The killing and reviving are done via the kill/revive functions
        for the SinglePlayer and MultiPlayer screens.

*/

/**
    Draws the SinglePlayer Stat Screen and tracks the character's stats
    This should be called only once as it actually creates Text Objects.
    If you want to redraw the single player stats screen after killing it,
        call reviveSinglePlayerScreen()

    character--The variable referring to the Sprite of the character
        (defaults to player one)
*/
function initSinglePlayerStatScreen(character){
    var HEALTH_BAR_X = GAME_WIDTH + 10;
    var HEALTH_BAR_Y = 100;
    var HEALTH_BAR_HEIGHT = 20;
    //maximum width in pixels the Health Bar will be
    var HEALTH_BAR_MAX_WIDTH = 360;
    console.log("initSinglePlayerScreen");
    statScreen.ShowAll = false;

    //set the Text displaying which character we are tracking
    statScreen.SinglePlayer.CharacterNameString = character.name;
    statScreen.SinglePlayer.CharacterName = game.add.text(GAME_WIDTH + 10, 10, character.name.toUpperCase(), {font: "4em Arial", fill: "#ff944d"});

    singleGraphics.clear();
    //redraw the healthbar and the text saying 'Health'
    singleGraphics.beginFill(HEALTH_BAR_COLOR);
    statScreen.SinglePlayer.HealthBar.Bar = singleGraphics.drawRect(HEALTH_BAR_X, HEALTH_BAR_Y, 
        (Math.floor(Math.random() * STAT_WIDTH)), 
        HEALTH_BAR_HEIGHT);
    singleGraphics.endFill();
    statScreen.SinglePlayer.HealthBar.HealthText = game.add.text(GAME_WIDTH + (STAT_WIDTH/2) -30, HEALTH_BAR_Y + HEALTH_BAR_HEIGHT + 10, "Health", {fill: "#33cc33", font: "2em Arial"});


    //Constant used to specify how many pixels to space out each attribute in the y-direction
    var attrStrSpacing = 35;
    //add the Attribute Strings to the StatScreen
    statScreen.SinglePlayer.AttributeStrings.MovementSpeed = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y, 
        "Movement Speed: " + dummyPlayer.stats.MovementSpeed, {font: "3em Arial", fill: DEF_COLOR});
    statScreen.SinglePlayer.AttributeStrings.Damage = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y + attrStrSpacing, 
        "Damage: " + dummyPlayer.stats.Damage, {font: "3em Arial", fill: DEF_COLOR});
    statScreen.SinglePlayer.AttributeStrings.AbilityPower = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y + 2*attrStrSpacing, 
        "Ability Power: " + dummyPlayer.stats.AbilityPower, {font: "3em Arial", fill: DEF_COLOR});
    statScreen.SinglePlayer.AttributeStrings.AttackRange = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y + 3*attrStrSpacing,
        "Attack Range: " + dummyPlayer.stats.AttackRange, {font: "3em Arial", fill: DEF_COLOR});
    statScreen.SinglePlayer.AttributeStrings.AttackSpeed = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y + 4*attrStrSpacing,
        "Attack Speed: " + dummyPlayer.stats.AttackSpeed, {font: "3em Arial", fill: DEF_COLOR});
    statScreen.SinglePlayer.AttributeStrings.Armor = game.add.text(GAME_WIDTH + 20, ATTRIBUTE_STRINGS_Y + 5*attrStrSpacing,
        "Armor: " + dummyPlayer.stats.Armor, {font: "3em Arial", fill: DEF_COLOR});

}

/**
    Creates The Text Objects for the multiplayer stat screen.
    Like initSinglePlayerScreen, this method should be called only once 

    TODO: Have Health Bars be From Actual JSON Rather Than Random Data
*/
function initMultiPlayerStatScreen(){
    console.log("initMultiPlayerStatScreen");

    var attrstyle = {font: "2em Arial", fill: DEF_COLOR};
    var nameStyle = {font: "3em Arial", fill: DEF_COLOR};
    //The height of each player's health bar
    var MULTI_HEALTHBAR_HEIGHT = 10;

    //defines where to start drawing text objects
    var startX = GAME_WIDTH + 20;

    //clear any graphics that were on the screen
    multiGraphics.clear();
    //Have it so all health bars have the same "fill" (color)
    multiGraphics.beginFill(HEALTH_BAR_COLOR);

    //Start drawing at y-coordinate of 5
    var yPos = 5;
    //Y-coordinate of where to draw the attribute strings
    var attrStrY = 0;
    //Draw the player stats
    for( player in statScreen.MultiPlayer){

      //init character name
      statScreen.MultiPlayer[player].CharacterName = game.add.text(startX, yPos, 
          statScreen.MultiPlayer[player].Sprite.name.toUpperCase(), nameStyle);

      attrStrY = statScreen.MultiPlayer[player].CharacterName.y + 
        statScreen.MultiPlayer[player].CharacterName.height - 5;
  
      //Create all the Text Objects for each player
      //init attribute strings
      //handle to the Attribute Strings...saves on typing
      var strings = statScreen.MultiPlayer[player].AttributeStrings;
      strings.Damage = game.add.text(startX, 
        attrStrY, "DMG", attrstyle);
      strings.AbilityPower = game.add.text(strings.Damage.x 
          + strings.Damage.width + 5,
          attrStrY, "AP", attrstyle);
      strings.AttackRange = game.add.text(strings.AbilityPower.x 
          + strings.AbilityPower.width + 5, 
          attrStrY, "AR", attrstyle);
      strings.AttackSpeed = game.add.text(strings.AttackRange.x 
          + strings.AttackRange.width + 5, 
          attrStrY, "AS", attrstyle);
      strings.Armor = game.add.text(strings.AttackSpeed.x 
          + strings.AttackSpeed.width + 5, 
          attrStrY, "ARMOR", attrstyle);
      strings.MovementSpeed = game.add.text(strings.Armor.x 
          + strings.Armor.width + 5, 
          attrStrY, "MS", attrstyle);
  
      //draw the healthbar
      statScreen.MultiPlayer[player].HealthBar = multiGraphics.drawRect(startX, 
          strings.MovementSpeed.y + strings.MovementSpeed.height, 
          (Math.floor(Math.random() * STAT_WIDTH)), 
          MULTI_HEALTHBAR_HEIGHT);

      //update yPos
      yPos += strings.MovementSpeed.height + MULTI_HEALTHBAR_HEIGHT + 50;
  
  }

    multiGraphics.endFill();

}

/**
    Revives the Multiplayer screen by calling killSinglePlayerStatScreen()
        and then calling revive() on all the text objects associated with
        the multiplayer screen
    This must be called after initMultiPlayerStatScreen has been called
    TODO: Have Health Bars be filled w/ JSON Health instead of random
*/
function reviveMultiPlayerStatScreen(){
    console.log("reviveMultiPlayerStatScreen");
    killSinglePlayerStatScreen();
    for (var player in statScreen.MultiPlayer){
            statScreen.MultiPlayer[player]["CharacterName"].revive();
            for (var attrString in statScreen.MultiPlayer[player]["AttributeStrings"]){
                if(statScreen.MultiPlayer[player]["AttributeStrings"].hasOwnProperty(attrString)){
                    statScreen.MultiPlayer[player]["AttributeStrings"][attrString].revive();
                }
            }
    }
    
    //redraw all the healthBars
    multiGraphics.beginFill(HEALTH_BAR_COLOR);
    var startX = GAME_WIDTH + 20;
    var MULTI_HEALTHBAR_HEIGHT = 10;
    var strings;
    for(player in statScreen.MultiPlayer){
      strings = statScreen.MultiPlayer[player].AttributeStrings;
      statScreen.MultiPlayer[player].HealthBar = multiGraphics.drawRect(startX, 
        strings.MovementSpeed.y + strings.MovementSpeed.height, 
        (Math.floor(Math.random() * STAT_WIDTH)), 
        MULTI_HEALTHBAR_HEIGHT);

    }

    multiGraphics.endFill();

}

/**
    Helper function that calls kill() on all the Text Objects associated with the
        multiplayer stat screen
*/
function killMultiPlayerStatScreen(){
    console.log("killMultiPlayerStatScreen");
    //clear all the healthbars
    multiGraphics.clear();
    //Call kill on all Phaser Text Objects of all players
    for (var player in statScreen.MultiPlayer){
        if(statScreen.MultiPlayer.hasOwnProperty(player)){
            statScreen.MultiPlayer[player]["CharacterName"].kill();
            for (var attrString in statScreen.MultiPlayer[player]["AttributeStrings"]){
                if(statScreen.MultiPlayer[player]["AttributeStrings"].hasOwnProperty(attrString)){
                    statScreen.MultiPlayer[player]["AttributeStrings"][attrString].kill();
                }
            }
        }

    }
}

/*
    Kills all of the single player stat screen's objects from being seen
    This does not destroy the object, but makes it invisible.
    To show the single player stat screen again, call reviveSinglePlayerScreen
*/
function killSinglePlayerStatScreen(){
    console.log("killSinglePlayerStatScreen")
    //indicate we are showing all of the player's stats
    statScreen.ShowAll = true;
    //Clears the healthbar
    singleGraphics.clear();
    statScreen.SinglePlayer.HealthBar.HealthText.kill();
    //kill all the Text objects for the singlePlayer screen
    for (var k in statScreen.SinglePlayer.AttributeStrings){
        if(statScreen.SinglePlayer.AttributeStrings.hasOwnProperty(k)){
            statScreen.SinglePlayer.AttributeStrings[k].kill();
        }
    }
    //kill the Text object containing the player name
    statScreen.SinglePlayer.CharacterName.kill();

}


/**
    Revives (redraws) the single player screen
    This must be called after initSinglePlayerScreen() has been called
    This method does not create new Text Objects, but rather "revives" the Text objects
        by calling Phaser's revive() method on them
*/
function reviveSinglePlayerScreen(){
    console.log("reviveSinglePlayerStatScreen");
    killMultiPlayerStatScreen();
    statScreen.ShowAll = false;
    statScreen.SinglePlayer.CharacterName.revive();

    var HEALTH_BAR_X = GAME_WIDTH + 10;
    var HEALTH_BAR_Y = 100;
    var HEALTH_BAR_HEIGHT = 20;
    //maximum width in pixels the Health Bar will be
    var HEALTH_BAR_MAX_WIDTH = 360;

    singleGraphics.clear();
    //redraw the healthbar and the text saying 'Health'
    singleGraphics.beginFill(HEALTH_BAR_COLOR);
    statScreen.SinglePlayer.HealthBar.Bar = singleGraphics.drawRect(HEALTH_BAR_X, HEALTH_BAR_Y, 
        (Math.floor(Math.random() * STAT_WIDTH)), 
        HEALTH_BAR_HEIGHT);
    singleGraphics.endFill();

    statScreen.SinglePlayer.HealthBar.HealthText.revive();


    //Revive all the Attribute Strings
    for (var attrStr in statScreen.SinglePlayer.AttributeStrings){
        if(statScreen.SinglePlayer.AttributeStrings.hasOwnProperty(attrStr)){
            statScreen.SinglePlayer.AttributeStrings[attrStr].revive();
        }
    }
    


    
}

/**
    This function is run every TIME_TO_NEXT_UPDATE milliseconds
    This function decides which screen to update:
        MultiPlayer StatScreen
        SinglePlayer StatScreen
*/
function updateStatScreen(){
	if(serverJSON.length > 0){
		//dequeue
		var nextTurn = serverJSON.shift();
        //move the sprites
        moveCharactersQuadrantAbsolute(nextTurn);
        //TODO: write helper function to add all spells
        //call release spells after ^^^


        //update the stats screen
        if(statScreen.ShowAll == true){
      	    updateMultiPlayerStatScreen(nextTurn);
       	}
       	else
       	    updateSinglePlayerStatScreen(nextTurn);
	}
}



/**
    Changes which character's stats are displayed
        in the SinglePlayer screen.
	
	character--the Phaser.Sprite object associated with that
		character
*/
function changeStatScreen(character){
    console.log("changeStatScreen called");
    console.log(character.name);
    statScreen.SinglePlayer.CharacterNameString = character.name;
    //clear all graphics drawn from the graphics reference
    singleGraphics.clear();
    //updates the name of the character whose stats are displayed
    //NOTE: Does not check to see if name will fit yet
    statScreen.SinglePlayer.CharacterName.setText((character.name).toUpperCase());
    if(statScreen.ShowAll == false)
        updateHealthBar(character);


}


/**
    Updates the colors of the AtrributeStrings of each player
        green if they have a buff
        red if they have a debuff
        orange if neutral


    Currently this has random data, but once the JSON is finalized
        I can add in the logic

	  Parameters:
      nextTurn--the turn as given by the server(JSON)

    Warning: This has a hardcoded font size for the AttributeStrings rather than attrStyle
        (didn't want to make that a global variable)
*/
//TODO: Work with actual JSON rather than random data
function updateMultiPlayerStatScreen(nextTurn){
    console.log("updateMultiPlayerStatScreen");

	//update the strings
    for (var player in statScreen.MultiPlayer){
        if(statScreen.MultiPlayer.hasOwnProperty(player)){
            for (var attrString in statScreen.MultiPlayer[player]["AttributeStrings"]){
                if(statScreen.MultiPlayer[player]["AttributeStrings"].hasOwnProperty(attrString)){

                    switch(Math.floor(Math.random()*3)){
                        //make the string red
                        case 0:
                            statScreen.MultiPlayer[player]["AttributeStrings"][attrString].setStyle({font: "2em Arial", fill: "#ff0000"});
                            break;
                        //make the string green
                        case 1:
                            statScreen.MultiPlayer[player]["AttributeStrings"][attrString].setStyle({font: "2em Arial", fill: "#00ff00"});
                            break;
                        //make the string orange (neutral)
                        default:
                            statScreen.MultiPlayer[player]["AttributeStrings"][attrString].setStyle({font: "2em Arial", fill: DEF_COLOR});
                            break;

                    }
                        
                }
            }
        }

    }

    //update healthbars
    multiGraphics.clear();
    multiGraphics.beginFill(HEALTH_BAR_COLOR);
    var startX = GAME_WIDTH + 20;
    var MULTI_HEALTHBAR_HEIGHT = 10;
    var strings;
    for (player in statScreen.MultiPlayer){
      strings = statScreen.MultiPlayer[player].AttributeStrings;
      statScreen.MultiPlayer[player].HealthBar = multiGraphics.drawRect(startX, 
        strings.MovementSpeed.y + strings.MovementSpeed.height, 
        (Math.floor(Math.random() * STAT_WIDTH)), 
        MULTI_HEALTHBAR_HEIGHT);
    }

    multiGraphics.endFill();
}

/**
    Called to update all the graphics associated with the 
        Stats Screen.
    If the character selected has changed, call changeStatScreen() before this

   Parameters:
    --nextTurn The next turn that was dequeued from the serverJSON
*/
//TODO: Repalce dummyPlayer with actual JSON from server
//		
function updateSinglePlayerStatScreen(nextTurn){
	console.log("updateSinglePlayerStatScreen");
  singleGraphics.clear();

  updateHealthBar(nextTurn);

	  //TODO: Need to choose which character's stats to read


    // update each Attribute String with data from the queue, and randomly switch each string to be 
    //  red (#ff0000) or green (#00ff00)
    // in the finished version the green or red will depend on a buff or debuff
    
    for(var attrStr in statScreen.SinglePlayer.AttributeStrings){
        if(statScreen.SinglePlayer.AttributeStrings.hasOwnProperty(attrStr)){
            statScreen.SinglePlayer.AttributeStrings[attrStr].setText(attrStr + ": " + nextTurn.stats[attrStr]);
            //make the stats green or red by random
            if(Math.floor(Math.random()*2)==0)
                statScreen.SinglePlayer.AttributeStrings[attrStr].setStyle({font: "3em Arial", fill: "#ff0000"});
            else
                statScreen.SinglePlayer.AttributeStrings[attrStr].setStyle({font: "3em Arial", fill: "#00ff00"});

        }
    }

}


/**
    Redraws the Health Bar
    Currently it sets to health bar to a random value,
        but later it will set to the health of the current
        player.

   Parameters:
    --nextTurn The next turn that was dequeued from the serverJSON
*/
//TODO: Have this fill the bar proportional to the % of the health the player has
//TODO: Use nextTurn data
function updateHealthBar(nextTurn){

    var HEALTH_BAR_X = GAME_WIDTH + 10;
    var HEALTH_BAR_Y = 100;
    var HEALTH_BAR_HEIGHT = 20;
    //maximum width in pixels the Health Bar will be
    var HEALTH_BAR_MAX_WIDTH = 360;
    //redraw the health bar
    singleGraphics.beginFill(HEALTH_BAR_COLOR);
    statScreen.SinglePlayer.HealthBar.Bar = singleGraphics.drawRect(HEALTH_BAR_X, HEALTH_BAR_Y, 
        (Math.floor(Math.random() * STAT_WIDTH)), 
        HEALTH_BAR_HEIGHT);
    singleGraphics.endFill();
}


/**
  Redraws the Health Bar for the MultiPlayer screen

  Parameters:
    --health The Integer value of the health
    --player An element of statScreen.MultiPlayer, which represents
        the  player whose health is being redrawn 
  */

//TODO: Finish
function updateHealthBarMulti(health, player){
}

//-----------------Test Functions--------------//

//Helper function for moveCharactersQuadrantTest()
//Randomizes the x and y of dummyLocation to an integer [0-4]
function randomizeMovement(){
    for (var k in dummyMovement){
        //ensure the property is not part of the prototype
        if(dummyMovement.hasOwnProperty(k)){
             for(var l in dummyMovement[k]){
                dummyMovement[k][l] = Math.floor(Math.random()*5);
            }
        }
       
    }
}


//Populates the queue with random data 

function populateQueue(){
    for(i = 0; i < 1500; i++){
        var derp = {
            "name" : null,
            "stats" : {
                "Health"        : 0,
                "Damage"        : 0,
                "AbilityPower" : 0,
                "AttackRange"   : 0,
                "AttackSpeed"   : 0,
                "Armor"         : 0,
                "MovementSpeed" : 0,
                "Abilities"     : [ 1 ]
            }, 
            "actions" : {
                "1" : "My Action"
            }
        };
        derp["name"] = "Johnson";
        for(var k in derp["stats"]){
            if(derp["stats"].hasOwnProperty(k)){
                derp["stats"][k] = Math.floor(Math.random()*300);
            }
        }
        serverJSON.push(derp);
    }
}




