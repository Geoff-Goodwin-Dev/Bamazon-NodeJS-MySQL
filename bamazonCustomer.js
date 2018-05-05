let mysql = require("mysql");
let inquirer = require("inquirer");
let Table = require('cli-table');

let inventorySimple = [];
let selectedItem;

let connection = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "bamazon"
});

connection.connect((err) => {
  if (err) throw err;
  showSimpleInventory();
});

const showSimpleInventory = () => {
  inventorySimple = [];
  connection.query('SELECT item_id, product_name, price FROM products', (err, res) => {
    if (err) throw err;
    console.clear();
    console.log('LISTING OF ITEMS CURRENTLY FOR SALE:');
    let table = new Table({
      head: ['Item ID', 'Product Name', 'Price'],
      colWidths: [12, 103, 15]
    });
    for (let item of res) {
      table.push([item.item_id, item.product_name, `$${item.price.toFixed(2)}`]);
      inventorySimple.push(item);
    }
    console.log(table.toString());
    console.log('');
    selectItemToBuy();
  });
};

const selectItemToBuy = () => {
  inquirer.prompt({
    name: 'selectedItemID',
    message: 'What Item ID would you like to buy?',
    type: 'input'
  }).then((answer) => {
    let item = parseInt(answer.selectedItemID);
    let itemIdArray = [];
    for (let item of inventorySimple) {
      itemIdArray.push(item.item_id);
    }
    if (itemIdArray.indexOf(item) < 0) {
      console.log(`That doesn't appear to be an accurate Item ID.  Please try again`);
      selectItemToBuy()
    }
    else {
      checkQuantityRemaining(item);
    }
  });
};

const checkQuantityRemaining = (itemID) => {
  console.log(`you've indicated you want to buy ${itemID}`);
  connection.query('SELECT item_id, product_name, price, stock_quantity FROM products WHERE ?',
    [
      {item_id: itemID}
    ],
    (err, res) => {
    if (err) throw err;
    let quantityRemaining = res[0].stock_quantity;
    if (quantityRemaining < 1) {
      console.log('It appears we may be out of that item at the moment.  We should have more in soon.');
      buySomethingElse();
    }
    else {
      selectedItem = res[0];
      console.log(`It appears we have ${quantityRemaining} remaining.`);
      selectQuantityToBuy();
    }
  });
};

const buySomethingElse = () => {
  console.log('');
  inquirer.prompt({
    name: 'buySomethingElse',
    message: 'Would you like to buy something else?',
    type: 'list',
    choices: ['Yes', 'No']
  }).then((answer) => {
    let buySomethingElse = answer.buySomethingElse;
    if (buySomethingElse === 'Yes') {
      showSimpleInventory();
    }
    else {
      console.log('Thanks for stopping by.  We look forward to seeing you next time!');
      connection.end();
    }
  });
};

const selectQuantityToBuy = () => {
  console.log('');
  inquirer.prompt({
    name: 'quantityRequested',
    message: 'How many would you like to buy?',
    type: 'input'
  }).then((answer) =>{
    let quantityRequested = answer.quantityRequested;
    if ((quantityRequested < 1) || (quantityRequested > selectedItem.stock_quantity) || ((parseInt(quantityRequested) - quantityRequested) !== 0)) {
      console.log(`The quantity to buy must be a positive whole number greater than 0 and less than or equal to ${selectedItem.stock_quantity}.`);
      selectQuantityToBuy();
    }
    else {
      console.log(`Excellent! We've processed your request.`);
      processBuy(quantityRequested);
    }
  });
};

const processBuy = (quantityToBuy) => {
  let newQuantityRemaining = selectedItem.stock_quantity - quantityToBuy;
  let totalCost = quantityToBuy * selectedItem.price;
  console.log(`The total price of your order is $${totalCost.toFixed(2)} for ${quantityToBuy} of "${selectedItem.product_name}"`);
  connection.query('UPDATE products SET ? WHERE ?',
    [
      {stock_quantity: newQuantityRemaining},
      {item_id: selectedItem.item_id}
    ],
    (err) => {
      if (err) throw err;
      buySomethingElse();
    }
  );
};