let mysql = require("mysql");
let inquirer = require("inquirer");
let Table = require('cli-table');

let inventory = [];
let lowInventory = [];
let selectedItem;
let itemToAdd = {};

let connection = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "bamazon"
});

connection.connect((err) => {
  if (err) throw err;
  fetchInventory()
});

const selectAction = () => {
  console.log('');
  inquirer.prompt({
    name: 'selectedAction',
    message: 'Would you like to do?',
    type: 'list',
    choices: ['View Products for Sale', 'View Low Inventory', 'Add to Inventory', 'Add New Product', 'Exit']
  }).then((answer) => {
    switch (answer.selectedAction) {
      case 'View Products for Sale':
        showFullInventory(renderInventoryTable);
        break;
      case 'View Low Inventory':
        showLowInventory();
        break;
      case 'Add to Inventory':
        selectItemToRestock();
        break;
      case 'Add New Product':
        specifyProductName();
        break;
      case 'Exit':
        console.log('Thanks for stopping by.  We look forward to seeing you next time!');
        connection.end();
        break;
      default:
        console.log('Error: not yet mapped');
        connection.end();
    }
  });
};

const renderInventoryTable = (res) => {
  let table = new Table({
    head: ['Item ID', 'Product Name', 'Price', 'Quantity Remaining'],
    colWidths: [12, 103, 15, 20]
  });
  for (let item of res) {
    table.push([item.item_id, item.product_name, `$${item.price.toFixed(2)}`, item.stock_quantity]);
    inventory.push(item);
  }
  console.log(table.toString());
  selectAction()
};

const fetchInventory = () => {
  connection.query("SELECT * FROM products", (err, res) => {
    if (err) throw err;
    for (let item of res) {
      inventory.push(item);
    }
    selectAction();
  });
};

const showFullInventory = (callback) => {
  inventory = [];
  connection.query('SELECT * FROM products', (err, res) => {
    if (err) throw err;
    callback(res);
  });
};

const showLowInventory = () => {
  let threshold = 5;
  lowInventory = [];
  connection.query('SELECT * FROM products WHERE stock_quantity <= ?', [threshold], (err, res) => {
    if (err) throw err;
    console.log(`LISTING OF ITEMS CURRENTLY IN STOCK WHERE AMOUNT REMAINING IS LESS THAN OR EQUAL TO ${threshold}:`);
    renderInventoryTable(res);
  });
};

const selectItemToRestock = () => {
  console.log('');
  selectedItem = {};
  inquirer.prompt({
    name: 'selectedItemID',
    message: 'What Item ID would you like to restock?',
    type: 'input'
  }).then((answer) => {
    for (let item of inventory) {
      if (item.item_id === parseInt(answer.selectedItemID)) {
        selectedItem = item;
      }
    }
    if (!selectedItem.hasOwnProperty('item_id')) {
      console.log(`That doesn't appear to be an accurate Item ID.  Please try again`);
      selectItemToRestock()
    }
    else {
      console.log(`You've selected "${selectedItem.product_name}" of which there are currently ${selectedItem.stock_quantity} remaining.`);
      selectQuantityToRestock();
    }
  });
};

const selectQuantityToRestock =() => {
  console.log('');
  inquirer.prompt({
    name: 'quantityRequested',
    message: 'How many would you like to buy to restock?',
    type: 'input'
  }).then((answer) => {
    let quantityRequested = answer.quantityRequested;
    if ((quantityRequested < 1) || ((parseInt(quantityRequested) - quantityRequested) !== 0)) {
      console.log(`The quantity to buy must be a positive whole number greater than 0.`);
      selectQuantityToRestock();
    }
    else {
      console.log(`Excellent! We've processed your request.`);
      processRestock(parseInt(quantityRequested));
    }
  });
};

const processRestock = (quantityToRestock) => {
  let newQuantityRemaining = selectedItem.stock_quantity + quantityToRestock;
  console.log(`We've processed your request to add ${quantityToRestock} of "${selectedItem.product_name}" to the store.`);
  console.log(`The updated amount remaining is ${newQuantityRemaining}.`);
  connection.query('UPDATE products SET ? WHERE ?',
    [
      {stock_quantity: newQuantityRemaining},
      {item_id: selectedItem.item_id}
    ],
    (err) => {
      if (err) throw err;
      fetchInventory();
    }
  );
};

const specifyProductName =() => {
  console.log('');
  let productNameArray = [];
  for (let item of inventory) {
    productNameArray.push(item.product_name);
  }
  inquirer.prompt({
    name: 'productNameSelection',
    message: 'What is the Product Name for the item you\'d like to add?',
    type: 'input'
  }).then((answer) => {
    let productNameSelection = answer.productNameSelection;
    if ((productNameSelection.length < 1) || (productNameSelection.length > 100)) {
      console.log(`The product name cannot be blank and cannot exceed 100 characters in length.`);
      specifyProductName();
    }
    else if (productNameArray.indexOf(productNameSelection) > 0) {
      console.log(`The product name of "${productNameSelection}" already exists and cannot be used again.`);
      specifyProductName();
    }
    else {
      itemToAdd.product_name = productNameSelection;
      console.log(`Your selection of "${productNameSelection}" has been accepted.`);
      specifyDepartmentName();
    }
  });
};

const arraySortCaseInsensitive = (array) => {
  array.sort((a, b) => {
    let nameA = a.toString().toLowerCase();
    let nameB = b.toString().toLowerCase();
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }
    return 0;
  });
};

const specifyDepartmentName = () => {
  console.log('');
  let departmentNameArray = [];
  for (let item of inventory) {
    if (departmentNameArray.indexOf(item.department_name) < 0) {
      departmentNameArray.push(item.department_name);
    }
  }
  arraySortCaseInsensitive(departmentNameArray);
  inquirer.prompt({
    name: 'departmentNameSelection',
    message: 'What is the Department Name for the item you\'d like to add?',
    type: 'list',
    choices: departmentNameArray.concat([new inquirer.Separator(), 'Create a new Department Name', new inquirer.Separator()])
  }).then((answer) => {
    if (answer.departmentNameSelection === 'Create a new Department Name') {
      addDepartmentName(departmentNameArray);
    }
    else {
      itemToAdd.department_name = answer.departmentNameSelection;
      specifyPrice();
    }
  });
};

const addDepartmentName = (departmentNameArray) => {
  console.log('');
  inquirer.prompt({
    name: 'departmentNameSelection',
    message: 'What is the Department Name you\'d like to add?',
    type: 'input'
  }).then((answer) => {
    let departmentNameSelection = answer.departmentNameSelection;
    if ((departmentNameSelection.length < 1) || (departmentNameSelection.length > 100)) {
      console.log(`The department name cannot be blank and cannot exceed 100 characters in length.`);
      addDepartmentName();
    }
    else if (departmentNameArray.indexOf(departmentNameSelection) > 0) {
      console.log(`The department name of "${departmentNameSelection}" already exists and cannot be used again.`);
      addDepartmentName();
    }
    else {
      itemToAdd.department_name = departmentNameSelection;
      console.log(`Your selection of "${departmentNameSelection}" has been accepted.`);
      specifyPrice();
    }
  });
};

const specifyPrice = () => {
  console.log('');
  inquirer.prompt({
    name: 'productPrice',
    message: 'What is the price for the item you\'d like to add (without the "$" included)?',
    type: 'input',
  }).then((answer) => {
    let productPrice = answer.productPrice;
    if (productPrice === '') {
      console.log(`The product price cannot be blank.`);
      specifyPrice();
    }
    else if ((Number.isNaN(productPrice)) || (productPrice < 0)) {
      console.log(`The product price must be a number greater than or equal to zero.`);
      specifyPrice();
    }
    else if (parseFloat(Number(productPrice).toFixed(2)) !== parseFloat(productPrice)) {
      console.log(`The price can only extend to two places past the decimal.`);
      specifyPrice();
    }
    else {
      itemToAdd.price = parseFloat(productPrice);
      console.log(`Your selected price of $${productPrice} has been accepted.`);
      specifyQuantity();
    }
  });
};

const specifyQuantity = () => {
  console.log('');
  inquirer.prompt({
    name: 'productQuantity',
    message: `How many of "${itemToAdd.product_name}" would you like to add?`,
    type: 'input'
  }).then((answer) => {
    let productQuantity = answer.productQuantity;
    if (productQuantity === '') {
      console.log(`The product quantity cannot be blank.`);
      specifyQuantity();
    }
    else if (!Number.isInteger(Number(productQuantity)) || (productQuantity < 0)) {
      console.log(`The product quantity can only be zero or a positive integer`);
      specifyQuantity();
    }
    else {
      itemToAdd.stock_quantity = parseInt(productQuantity);
      console.log(`Your selected quantity of ${productQuantity} has been accepted.`);
      addItemToDB();
    }
  });
};

const addItemToDB = () => {
  connection.query('INSERT INTO products (product_name,department_name,price,stock_quantity) VALUES (?, ?, ?, ?)',
    [
      itemToAdd.product_name,
      itemToAdd.department_name,
      itemToAdd.price,
      itemToAdd.stock_quantity
    ],
    (err) => {
      if (err) throw err;
      console.log('');
      console.log(`Successfully added ${itemToAdd.stock_quantity} of ${itemToAdd.product_name} to the inventory.`);
      console.log('=====================================================================================');
      fetchInventory();
    }
  );
};