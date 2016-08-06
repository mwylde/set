// slinky_require("lodash.js)
// slinky_require("d3.js)
///<reference path="types/lodash.d.ts" />
///<reference path="types/d3.d.ts" />

class Card {
  public color: number;
  public shape: number;
  public shading: number;
  public count: number;

  constructor(color: number, shape: number, shading: number, count: number) {
    this.color = color;
    this.shape = shape;
    this.shading = shading;
    this.count = count;
  }

  public serialize() {
    return `${this.color}${this.shape}${this.shading}${this.count}`;
  }

  public static deserialize(s: string) {
    return new Card(
      Number(s[0]), Number(s[1]), Number(s[2]), Number(s[3])
    );
  }
};

interface BoardCard {
  card: Card,
  boardIndex: number
}

interface SetCard {
  card: Card,
  setIndex: number,
  indexInSet: number
}

interface CardSet {
  cards: Array<Card>,
  time: Date
}

class SetGame {
  private el: HTMLElement;
  private sel: d3.Selection<HTMLElement>;
  private boardSel: d3.Selection<HTMLElement>;

  private deck: Array<Card>;
  private deckIndex = 16;
  private board: Array<BoardCard | SetCard>;
  private selected: Array<Card> = [];

  private sets: Array<CardSet> = [];

  private incorrectMores = 0;
  private incorrectSets = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    // generate all cards
    let allCards =
      [0, 1, 2].map((color =>
        [0, 1, 2].map(shape =>
          [0, 1, 2].map(shading =>
            [0, 1, 2].map(count =>
              new Card(color, shape, shading, count))))));

    this.deck = _(allCards).flattenDeep().shuffle().value() as Array<Card>;

    this.board = this.deck.slice(0, 12).map((c, i) => ({ card: c, boardIndex: i }))

    this.el.addEventListener("click", this.onClick.bind(this));
    document.getElementsByClassName("more")[0]
      .addEventListener("click", this.moreClicked.bind(this));
    document.getElementsByClassName("hint")[0]
      .addEventListener("click", this.hintClicked.bind(this));
    this.sel = d3.select(this.el);
    this.boardSel = this.sel.append("div").attr("class", "board");
  }

  private static attributeIsSet(a: number, b: number, c: number) {
    return (a == b && b == c) || (a != b && b != c && a != c);
  }

  private static isSet(c1: Card, c2: Card, c3: Card) {
    return SetGame.attributeIsSet(c1.color, c2.color, c3.color) &&
      SetGame.attributeIsSet(c1.shape, c2.shape, c3.shape) &&
      SetGame.attributeIsSet(c1.shading, c2.shading, c3.shading) &&
      SetGame.attributeIsSet(c1.count, c2.count, c3.count);
  }

  private static findSet(cards: Array<Card>) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (let k = j + 1; k < cards.length; k++) {
          if (SetGame.isSet(cards[i], cards[j], cards[k])) {
            return [cards[i], cards[j], cards[k]];
          }
        }
      }
    }
    return null;
  }

  private static setExists(cards: Array<Card>) {
    return SetGame.findSet(cards) != null;
  }

  private isBoardCard(card: BoardCard | SetCard): card is BoardCard {
    return ((<BoardCard>card).boardIndex) !== undefined;
  }

  public render() {
    let cards = this.boardSel
      .selectAll(".card")
      .data(this.board, c => c.card.serialize());

    let leftFn = c => {
      if (this.isBoardCard(c)) {
        return (c.boardIndex % 3) * 160 + "px";
      } else {
        return 3 * 160 + c.indexInSet * 50 + "px";
      }
    };

    let topFn = c => {
      if (this.isBoardCard(c)) {
        return Math.floor(c.boardIndex / 3) * 120 + "px";
      } else {
        return c.setIndex * 40 - 10 + "px";
      }
    };

    let transformFn = c => {
      if (this.isBoardCard(c)) {
        return "none";
      } else {
        return "scale(0.5, 0.5) rotate(90deg)";
      }
    };

    cards
      .transition()
      .duration(500)
      .style("left", leftFn)
      .style("top", topFn);

    this.boardSel
      .selectAll(".card.to-update")
      .classed("to-update", false)
      .classed("in-set", c => !this.isBoardCard(c))
      .data(this.board, c => c.card.serialize())
      .style("class", ".card")
      .style("z-index", (c, i) => {
        if (this.isBoardCard(c)) {
          return i;
        } else {
          return c.setIndex * 3 + 3 - c.indexInSet;
        }
      })
      .transition()
      .duration(500)
      .style("transform", transformFn)
      .style("left", leftFn)
      .style("top", topFn);

    let shapes = ["pill", "diamond", "squiggle"]

    cards
      .enter()
      .append("div")
      .attr("id", c => "card-" + c.card.serialize())
      .attr("class", c =>
        `card color-${c.card.color} shape-${c.card.shape} ` +
        `shading-${c.card.shading} count-${c.card.count}`)
      .attr("data-card", c => c.card.serialize())
      .attr("data-index", (c, i) => i)
      .style("left", leftFn)
      .style("top", topFn)
      .style("opacity", 0)
      .html(c =>
        _.repeat(`<svg viewBox="0 0 80 200">` +
          `<use xlink:href="icons/${shapes[c.card.shape]}.svg#shape"></use>` +
          `</svg>`, c.card.count + 1))
      .transition()
      .delay(200)
      .duration(500)
      .style("opacity", 1);

    if (this.deck.length <= this.deckIndex &&
      !SetGame.setExists(this.board.filter(this.isBoardCard).map(c => c.card))) {
      let gameOver = this.boardSel.append("div")
        .classed("modal-cover", true)
        .append("div")
        .classed("game-over", true);

      let time = Math.round((_.last(this.sets).time.getTime() - this.sets[0].time.getTime()) / 1000);

      gameOver
        .append("h2")
        .text("Game Over!")
      gameOver
        .append("p")
        .html(`You found ${this.sets.length} sets in ${time} seconds!<br>
             (an average of one every ${Math.round(time / this.sets.length * 10) / 10} seconds)`)

      let hints = document.getElementsByClassName("hint").length;
      gameOver
        .append("p")
        .html(`you used <b>${hints}</b> hints, selected <b>${this.incorrectSets}</b> ` +
        `incorrect sets, and incorrectly requested more cards ` +
        `<b>${this.incorrectMores}</b> times`);
    }

    return this;
  }

  private moreClicked() {
    let cards = this.board.filter(c => this.isBoardCard(c)).map(c => c.card);
    if (!SetGame.setExists(cards)) {
      for (let i = 0; i < 3; i++) {
        if (this.deck.length > this.deckIndex) {
          this.board.push({
            card: this.deck[this.deckIndex++],
            boardIndex: cards.length + i
          });
        }
      }
      this.render();
    } else {
      this.incorrectMores++;
    }
  }

  private hintClicked() {
    let s = SetGame.findSet(this.board.filter(this.isBoardCard).map(c => c.card));
    if (s != null) {
      for (let i = 0; i < s.length; i++) {
        let el = document.getElementById("card-" + s[i].serialize());
        if (!el.classList.contains("hint")) {
          el.classList.add("hint");
          break;
        }
      }
    }
  }

  private onClick(e: Event) {
    let el = e.target as HTMLElement;

    if (el.classList.contains("card")) {
      this.cardClicked(el);
    }
  }

  private cardClicked(el: HTMLElement) {
    if (el.classList.contains("in-set")) {
      return;
    }

    if (el.classList.contains("selected")) {
      el.classList.remove("selected");
    } else {
      el.classList.add("selected");
    }

    let selected = document.getElementsByClassName("selected");
    if (selected.length == 3) {
      let a = [].slice.call(selected);
      let cards = a.map(s => Card.deserialize(s.getAttribute("data-card")))

      if (SetGame.isSet(cards[0], cards[1], cards[2])) {
        this.sets.push({ cards: cards, time: new Date() });

        a.forEach((s, i) => {
          s.classList.add("to-update");
          let cardIndex = s.getAttribute("data-index");
          let setCard = <BoardCard>this.board[cardIndex];
          this.board[cardIndex] = {
            card: setCard.card,
            setIndex: this.sets.length - 1,
            indexInSet: i
          };

          let onBoard = ((this.board.filter(this.isBoardCard)) as BoardCard[])
            .sort((x, y) => x.boardIndex - y.boardIndex);

          if (this.deck.length > this.deckIndex) {
            if (setCard.boardIndex < 12) {
              // we only replace a card if it's within the original 12
              if (onBoard.length < 12) {
                // we only add cards if there are fewer than 12 out
                this.board.push({
                  card: this.deck[this.deckIndex++],
                  boardIndex: setCard.boardIndex
                });
              } else {
                // otherwise we shift a card from past 12
                _.last(onBoard).boardIndex = setCard.boardIndex;
              }
            }
          }
        });

        this.render();
      } else {
        this.incorrectSets++;
      }

      a.forEach(s => s.classList.remove("selected"));
    }
  }
};
