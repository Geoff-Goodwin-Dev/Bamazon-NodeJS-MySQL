let mysql = require("mysql");
let inquirer = require("inquirer");
let Table = require('cli-table');

let salesByDeptArray = [];

let connection = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "",
  database: "bamazon"
});

connection.connect((err) => {
  if (err) throw err;
  selectAction()
});

const selectAction = () => {
  console.log('');
  inquirer.prompt({
    name: 'selectedAction',
    message: 'Would you like to do?',
    type: 'list',
    choices: ['View Product Sales by Department', 'Create New Department', 'Exit']
  }).then((answer) => {
    switch (answer.selectedAction) {
      case 'View Product Sales by Department':
        showSalesByDept(renderInventoryTable);
        break;
      case 'Create New Department':
        fetchDepartmentNames();
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

const showSalesByDept = (callback) => {
  salesByDeptArray = [];
  let query = 'SELECT departments.department_id, departments.department_name, departments.over_head_costs, ';
  query += 'temp.dept_product_sales AS product_sales, temp.dept_product_sales - departments.over_head_costs AS total_profit FROM departments ';
  query += 'LEFT JOIN (SELECT department_name, SUM(price * product_sales) AS dept_product_sales FROM products GROUP BY department_name) temp ';
  query += 'ON (departments.department_name = temp.department_name) ORDER BY department_name;';
  connection.query(query, (err, res) => {
    if (err) throw err;
    callback(res);
  });
};

const renderInventoryTable = (res) => {
  let table = new Table({
    head: ['department_id', 'department_name', 'over_head_costs', 'product_sales', 'total_profit'],
    colWidths: [12, 50, 20, 20, 20]
  });
  for (let department of res) {
    if (typeof(department.product_sales) === 'object') {
      department.product_sales = 'N/A';
    }
    else {
      department.product_sales = `$${department.product_sales.toFixed(2)}`
    }
    if (typeof(department.total_profit) === 'object') {
      department.total_profit = 'N/A';
    }
    else {
      department.total_profit = `$${department.total_profit.toFixed(2)}`
    }
    table.push(
      [
        department.department_id,
        department.department_name,
        `$${department.over_head_costs.toFixed(2)}`,
        department.product_sales,
        department.total_profit
      ]
    );
    salesByDeptArray.push(department);
  }
  console.log(table.toString());
  selectAction()
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

const fetchDepartmentNames = () => {
  let departmentNameArray = [];
  connection.query('SELECT DISTINCT department_name FROM departments', (err, res) => {
    if (err) throw err;
    for (let item of res) {
      departmentNameArray.push(item.department_name);
    }
    arraySortCaseInsensitive(departmentNameArray);
    console.log(`The current list of departments are as follows: ${departmentNameArray.join(', ')}`);
    addDepartmentName(departmentNameArray);
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
      addDepartmentName(departmentNameArray);
    }
    else if (departmentNameArray.indexOf(departmentNameSelection) > 0) {
      console.log(`The department name of "${departmentNameSelection}" already exists and cannot be used again.`);
      addDepartmentName(departmentNameArray);
    }
    else {
      console.log(`Your selection of "${departmentNameSelection}" has been accepted.`);
      specifyOverheadCosts(departmentNameSelection);
    }
  });
};

const specifyOverheadCosts = (department_name) => {
  console.log('');
  inquirer.prompt({
    name: 'over_head_costs',
    message: 'What is the overhead cost for the department you\'re adding (without the "$" included)?',
    type: 'input',
  }).then((answer) => {
    let over_head_costs = answer.over_head_costs;
    if (over_head_costs === '') {
      console.log(`The overhead cost cannot be blank.`);
      specifyPrice();
    }
    else if ((Number.isNaN(over_head_costs)) || (over_head_costs < 0)) {
      console.log(`The overhead cost must be a number greater than or equal to zero.`);
      specifyPrice();
    }
    else if (parseFloat(Number(over_head_costs).toFixed(2)) !== parseFloat(over_head_costs)) {
      console.log(`The overhead cost can only extend to two places past the decimal.`);
      specifyPrice();
    }
    else {
      over_head_costs = parseFloat(over_head_costs);
      console.log(`Your selected overhead cost of $${over_head_costs} has been accepted.`);
      writeDeptToDB(department_name, over_head_costs);
    }
  });
};

const writeDeptToDB = (department_name, over_head_costs) => {
  connection.query('INSERT INTO departments (department_name,over_head_costs) VALUES (?, ?)',
    [
      department_name,
      over_head_costs
    ],
    (err) => {
      if (err) throw err;
      console.log('');
      console.log(`Successfully added ${department_name} with overhead cost of ${over_head_costs} to the database.`);
      console.log('=====================================================================================');
      selectAction();
    }
  );
};