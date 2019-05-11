var gameBoardSize = 40, gameMaxTime = 60

const colors = {
  neutral: 'white',
  black: 'black',
  green: 'green',
  red: 'red',
  lightblue: 'lightblue',
  gray: 'gray'
}

// Basic class producing a virtual dot object of our game, which is used to create visual representations of dots on board.
class Dot {
  constructor (id, row, column, color) {
    this.id = id
    this.color = color
    this.row = row
    this.column = column
    this.neighbours = []
    this.partners = []
    this.encircled = false
    this.connected = false
    this.aiPriority = 0
  }
  setPartners(other) {
    if (!this.partners.includes(other)) {
      this.partners.push(other)
      other.partners.push(this)
    }
  }
}

// Basic class producing lines connecting dots in game. used when players encircles other player’s dots:
class Line {
  constructor (startX, startY, endX, endY, color) {
    this.startX = startX
    this.startY = startY
    this.endX = endX
    this.endY = endY
    this.color = color
  }
}

// Basic class for the groups of neighbouring sanme-color dots used to find potential encirclements etc.:
class Group {
  constructor (color, dots=[], breakouts=[]) {
    this.color = color
    this.dots = dots
    this.breakouts = breakouts
  }
  shouldBeFirst(other) {
    if (this.dots.length === 0) {
      return true
    } else {
      return (this.dots[0].row < other.dots[0].row || this.dots[0].column < other.dots[0].column)
    }
  }  
  mergeWith(other) {
    let thisFirst = this.shouldBeFirst(other), index = 0
    for (let dot of other.dots) {
      if (!this.dots.includes(dot)) {
        if (thisFirst) {
          this.dots.push(dot)
        } else {
          this.dots.splice(index, 0, dot)
          index++
        }
      }
    }
    for (let dot of other.breakouts) {
      if (!this.breakouts.includes(dot)) {
        this.breakouts.push(dot)
      }
    }
  }
}

// Two-dimensions geometry functions used to check if player clicks are hitting board objects, if objects encapsulates each other etc.
var geometry = {
  startPoint: undefined,
  currentEncirclement: [],
  ifPointIsInsideCircle: function(pointX, pointY, circle) {
    return ((Math.abs((circle.row*35)-pointX) <= 15) && (Math.abs((circle.column*35)-pointY) <= 15))
  },
  // This method checks if two dots on the board could be connected by the player:
  ifDotCouldBeConnected: function(dotA, dotB) {
    if (this.currentEncirclement.includes(dotB)) {
      // You can use the same dot only if it is a first dot of encirclement, in such case you close encirclement:
      if (this.ifEnvelopeIsDone(dotB)) {
        return (this.ifNeighbours(dotA, dotB) && (this.ifSameColor(dotA, dotB)))
      }
    }
    else {
      return ((Math.abs(dotA.row-dotB.row) <= 1) && (Math.abs(dotA.column-dotB.column) <= 1) && (dotA != dotB) && this.ifSameColor(dotA, dotB))
    }
    return false
  },
  // This method only works if we play on square board, so number of rows = number of columns
  calculateId: function(row, column) {
    return ((gameBoardSize*(row-1))+column)
  },
  ifSameColor: function(dotA, dotB) {
    return dotA.color == dotB.color
  },
  ifEdgeDot: function(dot) {
    return (dot.row == 1 || dot.row == gameBoardSize || dot.column == 1 || dot.column == gameBoardSize)
  },
  findAllNeighbours: function(dot) {
    let positions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
    let neighbours = []
    for (let pos of positions) {
      let row = dot.row+pos[0], col = dot.column+pos[1]
      if (row > 0 && row <= gameBoardSize && col > 0 && col <= gameBoardSize) {
        let id = this.calculateId(row, col)
        neighbours.push(game.dots[id-1])
      }
    }
    return neighbours
  },
  ifNeighbours: function(dotA, dotB) { 
    return dotA.neighbours.includes(dotB)//(dotA != dotB) && (Math.abs(dotA.row-dotB.row) <= 1) && (Math.abs(dotA.column-dotB.column) <= 1)
  },
  ifSameRowAndCol: function(dotA, dotB) {
    return (dotA.row == dotB.row && dotA.column != dotB.column) || (dotA.row != dotB.row && dotA.column == dotB.column)
  },
  ifDotScoresPoint: function(dot) {
    return ((dot.color !== game.currentPlayer) && (dot.color !== colors.neutral))
  },
  ifEnvelopeIsDone: function(dot) {
    return (dot == geometry.currentEncirclement[0])
  },
  // This method counts the encircled dots when an envelope is finished and adds them to the player’s points:
  countEncircledDots: function(encirclement) {
    let polygon = []
    let polyRows = [], polyCols = []
    for (let dot of encirclement) {
      let x = dot.row, y = dot.column
      polyRows.push(x)
      polyCols.push(y)
      dot.connected = true
      polygon.push([x*35, y*35])
    }
    // This piece of code „shortcuts” searching for encircled dots, to avoid checking whole list of game.dots
    let dotsMinRow  = Math.min.apply(Math, polyRows), dotsMinCol = Math.min.apply(Math, polyCols),
    dotsMaxRow = Math.max.apply(Math, polyRows), dotsMaxCol = Math.max.apply(Math, polyCols),
    dotsToCheck = game.dots.slice(this.calculateId(dotsMinRow, dotsMinCol), this.calculateId(dotsMaxRow, dotsMaxCol))
    //console.log('dots to check: ', dotsToCheck.length)
    let aquiredPoints = 0
    for (let dot of dotsToCheck) {
      if (!dot.encircled && !this.currentEncirclement.includes(dot) && this.ifInsideOfPolygon(dot, encirclement)) {
        dot.encircled = true
        if (this.ifDotScoresPoint(dot)) {
          dot.color = game.currentPlayer
          aquiredPoints++
        } else {
          dot.color = colors.gray
        }
      }
    }
    game.points[game.currentPlayer] += aquiredPoints
  },
  ifDotInsideOfPolygon: function(dot, polygon) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

    var x = dot.row*35, y = dot.column*35;

    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i][0], yi = polygon[i][1];
        var xj = polygon[j][0], yj = polygon[j][1];

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
  },
  /* My method of checking if a point is inside of a encirclement (polygon connecting dots).*/
  ifInsideOfPolygon: function(dot, encirclement) {
    let lessRows = false, highRows = false, lessCols = false, highCols = false,
        row = dot.row, column = dot.column
    for (let node of encirclement) {
      let nodeRow = node.row, nodeCol = node.column
      if (nodeRow == row) {
        if (nodeCol < column) {
          lessCols = true
        } else if (nodeCol > column) {
          highCols = true
        }
      } else if (nodeCol == column) {
        if (nodeRow < row) {
          lessRows = true
        } else if (nodeRow > row) {
          highRows = true
        }
      }
      if (lessRows && lessCols && lessCols && highRows) {
        return (lessRows && lessCols && lessCols && highRows)
      }
    }
    return false
  }
}

/* New game object is created for each game. It is a collection of current game statistics, and
basic methods called when player or AI captures dots or builds an envelopement.*/
var game = {
  againstAi: false,
  players: [],
  currentPlayer: undefined,
  dots:[],
  pointedDot: undefined,
  startDot: undefined,
  lines: [],
  encirclements: {},
  points: {},
  turn: 1,
  encircling: false,
  // First function to be called - it creates a new game.
  startNewGame: function() {
  // First, player decides if he wants to play against another player or vs computer:
    var opponentChoice = document.createElement('label')
    opponentChoice.innerHTML = 'Who do you want to play against?'
    document.getElementById('settings').appendChild(opponentChoice)
    
    var buttonAi = document.createElement('button')
    buttonAi.innerHTML = 'Computer'
    buttonAi.style.marginLeft = '20px'
    buttonAi.addEventListener('click', function() {
      game.againstAi = true
      game.colorChoice()
    })
    document.getElementById('settings').appendChild(buttonAi)
    
    var buttonHuman = document.createElement('button')
    buttonHuman.innerHTML = 'Human'
    buttonHuman.style.marginLeft = '20px'
    buttonHuman.addEventListener('click', function() {
      game.againstAi = false
      game.colorChoice()
    })
    document.getElementById('settings').appendChild(buttonHuman)
  },
  colorChoice: function(reservedColor=undefined) {
    visual.clearChildren('settings')
    let clrChoice = document.createElement('label')
    clrChoice.innerHTML = 'Choose your color:'
    document.getElementById('settings').appendChild(clrChoice)
    if (game.players.length < 2) {
      for (let color in colors) {
        if (color != 'neutral' && color != reservedColor) {
          let btn = document.createElement('button')
          btn.innerHTML = color
          btn.style.marginLeft = '10px'
          btn.style.background = color
          btn.addEventListener('click', function(){
            game.players.push(color)
            if (game.againstAi) {
              let aiColors = []
              for (let col in colors) {
                if (col != color && col != 'neutral') {
                  aiColors.push(col)
                }
              }
              aiLogic.color = aiLogic.getRandom(aiColors)
              game.players.push(aiLogic.color)
            }
            game.colorChoice(color)
          })
          document.getElementById('settings').appendChild(btn)
        }
      }
    } else {
      game.currentPlayer = aiLogic.getRandom(game.players)
      visual.clearChildren('settings')
      this.createNewBoard()
      if (this.againstAi && this.currentPlayer == aiLogic.color) {
        aiLogic.makeAiMove()
      }
    }
  },
  createNewBoard: function () {
    for (let player in this.players) {
      this.encirclements[game.players[player]] = []
      this.points[game.players[player]] = 0
    }
    let totalDots = 0
    for (let i = 1; i<gameBoardSize+1; i++) {
      for (let y = 1; y<gameBoardSize+1; y++) {
        totalDots++
        this.dots.push(new Dot(totalDots, i, y, colors.neutral));
      }
    }
    for (let dot of this.dots) {
      dot.neighbours = geometry.findAllNeighbours(dot)
    }
    visual.drawBoard();
  },
  // This method adds new encirclement-line connecting two dots of same player:
  addLine: function(startDot, endDot) {
    game.lines.push(new Line(startDot.column*35, startDot.row*35, endDot.column*35, endDot.row*35, startDot.color))
    visual.drawBoard()
  },
  captureDot: function(dot) {
    dot.color = game.currentPlayer
    if (aiLogic.color !== undefined) {
      if (game.currentPlayer === aiLogic.color) {
        aiLogic.registerDot(dot, aiLogic.aiDots)
      } else {
        aiLogic.registerDot(dot, aiLogic.playersDots)
      }
    }
    game.nextTurn();
  },
  startEncirclement: function(dot) {
    game.encircling = true;
    geometry.startPoint = dot;
    geometry.currentEncirclement.push(dot)
  },
  makeEncirclement: function(dot) {
    if (geometry.ifDotCouldBeConnected(geometry.startPoint, dot)) {
      game.addLine(geometry.startPoint, dot)
      geometry.previousDot = geometry.startPoint
      geometry.startPoint.setPartners(dot)
      geometry.startPoint = dot
      // If player connected new encirclement with his own old lines or closed it:
      if (geometry.ifEnvelopeIsDone(dot)) {
        game.finishEncirclement(geometry.currentEncirclement)
      }
      else {
        geometry.currentEncirclement.push(dot)
      } 
    }
    else {
      alert('You can connect only neighbouring dots! row:' + geometry.startPoint.row + ', col: '+ geometry.startPoint.column + ', row:' + dot.row + ', col:' + dot.column)
      game.breakEncirclement()          
    }
  },
  breakEncirclement: function() {
    this.startDot = undefined
    for (let point in geometry.currentEncirclement) {
      geometry.currentEncirclement[point].connected = false
      if (point > 0) {
        this.lines.pop()
      }
    }
    geometry.currentEncirclement = []
    game.encircling = false
    game.nextTurn()
  },
  finishEncirclement: function(encirclement) {
    this.encirclements[game.currentPlayer].push(geometry.currentEncirclement)
    geometry.countEncircledDots(geometry.currentEncirclement)
    geometry.currentEncirclement.length = 0
    this.startDot = undefined
    this.encircling = false
    visual.drawBoard()
  },
  swapPlayers: function() {
    for (let player of this.players) {
      if (player != this.currentPlayer) {
        return player
      }
    }
  },
  // This method changes game’s turn and set current player:
  nextTurn: function() {
    this.turn++
    this.currentPlayer = this.swapPlayers()
    visual.drawBoard()
    if (this.currentPlayer === aiLogic.color) {
      aiLogic.makeAiMove()
    }
  }
}

/* A visual representation of our game is created and refreshed when players are clicking the board.
Scores, Board, lines and colored dots on the board are basically one picture drawn procedurally step 
by step. Every time when a change occures on the board, it is redrawn.*/
var visual = {
  // Removes all children from a DOM node
  clearChildren: function(id) {
    let children = document.getElementById(id).children
    while (children.length > 0){
      document.getElementById(id).removeChild(children[0])
    }
  },
  // This method is called each time, when something visible changes on the board:
  drawBoard: function() {
    this.clearChildren('score')
    let board = document.getElementById('board')
    let ctx = board.getContext('2d')
    for (let player of game.players) {
      let playerScore = document.createElement('label')
      playerScore.innerHTML = player + ' player: ' + game.points[player] + '  '
      playerScore.style.color = player
      document.getElementById('score').appendChild(playerScore)
    }
    ctx.clearRect(0, 0, board.width, board.height)
    if (game.startDot !== undefined) {
      ctx.beginPath()
      ctx.arc(game.startDot.column*35, game.startDot.row*35, 10, 2, Math.PI * 3)
      ctx.strokeStyle = 'green'
      ctx.stroke()
    }
    for (let i = 1; i <= gameBoardSize; i++) {
      ctx.lineWidth = 0.35
      ctx.beginPath()
      ctx.moveTo(35, i*35)
      ctx.strokeStyle = colors.black
      ctx.lineTo(gameBoardSize*35, i*35)
      ctx.stroke()
      
      ctx.beginPath()
      ctx.moveTo(i*35, 35)
      ctx.strokeStyle = colors.black
      ctx.lineTo(i*35, gameBoardSize*35)
      ctx.stroke()
      ctx.lineWidth = 1
    }
    for (let dot of game.dots) {
      ctx.beginPath()
      ctx.arc(dot.column*35, dot.row*35, 5, 0, Math.PI * 2)
      ctx.fillStyle = dot.color
      ctx.fill()
      ctx.strokeStyle = 'black'
      ctx.stroke()
    }
    for (let line of game.lines) {
      ctx.beginPath()
      ctx.moveTo(line.startX, line.startY)
      ctx.strokeStyle = line.color
      ctx.lineTo(line.endX, line.endY)
      ctx.stroke()
    }
  }
}

/* All the logic behind the computer-player. It stores data required for computer to make 'reasonable'
decisions when playing against human: find player’s dots which could be encircled, block player’s attempts
of encircling it’s own dots, capture random dots, when there is no envelopement possible to do.
TODO:
1. In method findDotsInDanger: algorithm to count friends and dangers for every dot’s combination on board
and amount of dots in group [x].
2. Sound effects (capturing dot, drawing line, closing envelopement, scoring points)? [ ].
3. A way for AI to detect and block 'remote' encirclements mad by human player [ ].
4. Identify why program enters infinite loop: what are conditions of this event? [x].
4.1. Program enters infinity loop when there are 2 unconnectable chains in mergeAllChains function of 
    encirclePlayerGroup method (one chain is separated inside of player’s group).
5. Why computer sometimes does not see lone endangered dot? [ ].
*/
var aiLogic = {
  color: undefined,
  aiDots: [],
  playersDots: [],
  prioritizedDots: [],
  aiGroups: [],
  playerGroups: [],
  breakoutDot: undefined,
  potentialAiEncirclements: [],
  potentialPlayerEncirclements: [],
  makeAiMove: function() {
    this.updateGroups()
    game.nextTurn()
    /*
    let playerInDanger = this.findDotsInDanger(this.playerGroups)
    let aiInDanger = this.findDotsInDanger(this.aiGroups)
    
    if (playerInDanger !== undefined) {
      if (playerInDanger.breakouts.length === 0) {
        console.log('encircling: size: ', playerInDanger.dots.length)
        this.encirclePlayerGroup(playerInDanger)
      } else if (aiInDanger !== undefined && aiInDanger.breakouts.length === 1) {
        if (aiInDanger.dots.length >= playerInDanger.dots.length) {
          game.captureDot(aiInDanger.breakouts[aiInDanger.breakouts.length-1])
        } else {
          game.captureDot(playerInDanger.breakouts[playerInDanger.breakouts.length-1])
        }
      } else {
        game.captureDot(playerInDanger.breakouts[playerInDanger.breakouts.length-1])
      }
    } else if (aiInDanger !== undefined && aiInDanger.breakouts.length === 1) {
      game.captureDot(aiInDanger.breakouts[aiInDanger.breakouts.length-1])
    } else if (this.prioritizedDots.length > 0) {
      //console.log('priority')
      game.captureDot(this.calculatePriority())    
    } else {
      //console.log('random')
      game.captureDot(this.getRandom(game.dots))
    }*/
  },
  getRandom: function(list) {
    return list[(Math.floor(Math.random() * list.length))]
  },
  registerDot: function(dot, dots) {
    dots.push(dot)
    this.prioritizeNeighbours(dot)
    this.updateGroups()
  },
  prioritizeNeighbours: function(dot) {
    dot.aiPriority = 0
    if (dot.color !== aiLogic.color) {
      for (let neighbour of dot.neighbours) {
        if (neighbour.color === colors.neutral) {
          neighbour.aiPriority++
          if (!this.prioritizedDots.includes(neighbour)) {
            this.prioritizedDots.push(neighbour)
          }
        }
      }
    }
  },
  calculatePriority: function() {
    let result, prioritized = this.prioritizedDots, highestPriority = 0
    for (let dot of prioritized) {
      if (dot.color !== colors.neutral) {
        dot.aiPriority = 0
      }
    }
    
    for (let dot of prioritized) {
      if (dot.aiPriority > highestPriority) {
        highestPriority = dot.aiPriority
        result = dot
      }
    }
    
    return result
  },
  // Adds captured dot to existiong group of dots or creates new Group object, if dot lies away from existing groups
  addToGroup: function(groups, dot) {
    let toMerge = [], merged = new Group(dot.color)
    for (let group of groups) {
      if (!group.dots.includes(dot)) {
        for (let node of group.dots) {
          if (geometry.ifNeighbours(dot, node) && (geometry.ifSameRowAndCol(dot, node) || node.partners.includes(dot))) {
            if (node.column > dot.column || node.row > dot.row) {
              group.dots.splice(group.dots.indexOf(node), 0, dot)
            } else {
              group.dots.splice(group.dots.indexOf(node)+1, 0, dot)
            }
            toMerge.push(group)
            break
          }
        }
      }
    }
    
    if (toMerge.length == 0) {
      merged.dots.push(dot)
      groups.push(merged)
    } else if (toMerge.length > 1) {
      for (let grp of toMerge) {
        merged.mergeWith(grp)
        groups.splice(groups.indexOf(grp), 1)
      }
      groups.push(merged)
    }
  },
  // This method deletes from groups dots captured by the opponents and kills empty groups
  updateGroups: function() {
    this.aiGroups.length = 0
    this.playerGroups.length = 0
    let aiSet = [this.aiDots, this.aiGroups], playerSet = [this.playersDots, this.playerGroups],
    sets = [aiSet, playerSet]
        
    for (let set of sets) {
      for (let dot of set[0]) {
        if (!dot.encircled) {
          this.addToGroup(set[1], dot)
        } else {
          set[0].splice(set[0].indexOf(dot), 1) // delete dot from dots if it is encircled so cold not be added to groups
        }
      }
    }
  },
  // Searches through the all groups of dots to detect if any of them is endangered of being encircled:
  findDotsInDanger: function(groups) {
    let endangered = [], highestDanger = 0, result
    
    for (let group of groups) {
      group.breakouts.length = 0
      let groupIndex = 0, dangerTotal = 0, friendsTotal = 0, checked = []
      for (let dot of group.dots) { 
        let dotIndex = 0, danger = 0, friends = 0, escape
        groupIndex++
        for (let neighbour of dot.neighbours) {
          if (geometry.ifSameRowAndCol(dot, neighbour)) {
            dotIndex++
            if (neighbour.color == dot.color) {
              friends++
            } else if (neighbour.color == colors.neutral) {
              escape = neighbour
              group.breakouts.push(neighbour)
            } else {
              danger++
            }
          }
        }
        friendsTotal+=friends
        dangerTotal+=danger
        if (this.ifEncircled(dot, groupIndex, dotIndex, danger, friends) && !geometry.ifEdgeDot(dot)) {
          let endGrp = new Group(dot.color)
          endGrp.dots.push(dot)
          endangered.push(endGrp)
        } else if (this.ifEndangered(dot, groupIndex, dotIndex, danger, friends) && !geometry.ifEdgeDot(dot)) {
          let endGrp = new Group(dot.color)
          endGrp.dots.push(dot)
          endGrp.breakouts.push(escape)
          endangered.push(endGrp)
        }
      }
      if (!endangered.includes(group) && (group.breakouts.length == 1 || 
        (dangerTotal > 3 && dangerTotal+friendsTotal)/4 == group.dots.length)) {
        endangered.push(group)
      }
    }

    if (endangered.length > 0) {
      for (let grp of endangered) {
        if (grp.breakouts.length < 2 && grp.dots.length > highestDanger) {
          highestDanger = grp.dots.length
          result = grp
          console.log(grp.dots.length, grp.breakouts.length, grp.dots[0].row, grp.dots[0].column)
        }
      }
    }
    return result
  },
  // This one checks if a particular dot is endangered of being encircled:
  ifEndangered: function(dot, groupIndex, dotIndex, danger, friends, groupSize) {
    return (danger == 3 && friends == 0 && !dot.connected && !dot.encircled)
  },
  ifEncircled: function(dot, groupIndex, dotIndex, danger, friends) {
    return (danger == 4 && !dot.connected && !dot.encircled)
  },
  /* This method controls how AI encircles player’s group of dots with lines. It must be provided with
  an Group object from aiLogic.playerGroups array as an argument and this Group must have 0 breakeouts.
  
  This method iterates through all the dots of a player’s group, loops over all their neighbouring dots
  to find AI-dots placed around, and puts found AI-dots into shorter „chains” of dots. Dividing envelope
  for shorter chains is required to deal with various, possible shapes of encircled groups. At the end all
  shorter chains are connected into one clock-wise envelopement.
  */
  encirclePlayerGroup: function(group) {
    //debugger;
    // These are nested helper functions and variables:
    let findInChains = function(neighbour, chains) {
      // We check if AI dot is already put into one of the chains, to avoid counting them many times
      for (let chain of chains) {
        if (chain.includes(neighbour)) {
          return 
        }
      }
      return false
    }
    
    let putIntoTheChain = function(neighbour, chains) {
      // If a dot is not included, we put it into the proper chain: which first or last node is a neighbour of our dot
      let added = false
      for (let chain of chains) {
        if (geometry.ifNeighbours(neighbour, chain[0])) {
          chain.unshift(neighbour)
          added = true
          break
        } else if (geometry.ifNeighbours(neighbour, chain[chain.length-1])) {
          chain.push(neighbour)
          added = true
          break
        }
      }
      if (!added) {
        chains.push([neighbour,])
      }
    }
    
    let mergeChains = function(baseChain, addedChain) {
      // We connect the chains pair by step
      for (let dot of addedChain) {
        baseChain.push(dot)
      }
    }    
    
    let mergeAllChains = function(chains) {
      // Connecting shorter chains, while preserving clock-wise order of dots    
      while (chains.length > 1) {
        for (let chainA of chains) {
          for (let chainB of chains) {
            if (geometry.ifNeighbours(chainA[0], chainB[chainB.length-1])) {
              mergeChains(chainB, chainA)
              chains.splice(chains.indexOf(chainA), 1)
              break
            } else if (geometry.ifNeighbours(chainA[chainA.length-1], chainB[0])) {
              mergeChains(chainA, chainB)
              chains.splice(chains.indexOf(chainB), 1)
              break
            }
          }
        }
      }
      return chains[0]
    }
    
    let deleteInsiders = function(chain) {
      // Some dots of envelopement are useless, and we evade them:
      for (let dot of chain) {
        let insideLevel = 0
        for (let node of dot.neighbours) {
          if (chain.includes(node) || group.dots.includes(node)) {
            insideLevel++
          }
        }
        if (insideLevel == 8) {
          chain.splice(chain.indexOf(dot), 1)
        }
      }
      return chain
    }
    
    let chains = [], envelopement
    
    // Execution of method starts here:
    for (let dot of group.dots) {
      for (let neighbour of dot.neighbours) {
        if (neighbour.color == aiLogic.color && geometry.ifSameRowAndCol(dot, neighbour) &&
           !neighbour.encircled) {
          if (findInChains(neighbour, chains) == false) {
            putIntoTheChain(neighbour, chains)
          }
        }    
      }
    }
    
    envelopement = deleteInsiders(mergeAllChains(chains))
    envelopement.push(envelopement[0]) // to make encirclement closes itself
    
    console.log('envelopement dots:')
    for (let node of envelopement) {
      console.log('id: ',node.id, ', row: ',node.row,', col: ', node.column)
    }
    
    for (let i = 0; i < envelopement.length; i++) {
      if (i == 0) {
        game.startEncirclement(envelopement[i])
      } else {
        game.makeEncirclement(envelopement[i])
      }
    }
    
    this.updateGroups()
    
    aiLogic.makeAiMove()
  }
}

// All event handlers are collected and organised here.
var eventHandlers = {
  board: document.getElementById('board'),
  boardListener: function() {
    this.board.addEventListener('click', function (event) {
      for (let dot of game.dots) {
        //let dot = game.dots[point]
        // If player clicked on the dot on the board:
        if (geometry.ifPointIsInsideCircle(event.offsetY, event.offsetX, dot)) {
          // Players can capture or use for encircling the 'free’ (not-encircled) dots:
          if (dot.encircled === false) {
            // If layer is making an encirclement by connecting his dots:
            if (game.encircling) {
              game.makeEncirclement(dot)
            } 
            // Else, if player is capturing dots:
            else {
              // If dot is not possesed by any player he captures it:
              if (dot.color === 'white') {
                game.captureDot(dot)
              }
              // If it is his own dot, and he clicks on it, he can start to encircle other-player’s dots:
              else if (dot.color === game.currentPlayer) {
                game.startDot = dot
                visual.drawBoard()
                game.startEncirclement(dot)
              }
            }
          }
          else {
            alert('You cannot connect encircled dots!')
          }
        }
      }
    })
  }
}

// Initializations:
eventHandlers.boardListener()
game.startNewGame()
//game.createNewBoard()