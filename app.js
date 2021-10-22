// Required Modules
const mongoose = require('mongoose')
const express = require('express')
const app = express()
const methodOverride = require('method-override')
const fs = require('fs')
var fastcsv = require('fast-csv')

// Using EJS view engine
app.set('view engine', 'ejs')

// parse the content of the incoming request
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'))
app.use('/public', express.static(__dirname + '/public'))

const PORT = process.env.PORT || '3000'

// ======================= DB Setup =======================
const { MongoClient, GridFSBucketWriteStream } = require('mongodb')
const url =
	'mongodb+srv://Cam:SWE20001DB@swe20001.vljb8.mongodb.net/SWEproject?retryWrites=true&w=majority'
const client = new MongoClient(url, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
mongoose.connect(url, { useNewUrlParser: true })

// ======================= Schema & Models =======================
/* Inserting from node */
// create the schema
const productsSchema = new mongoose.Schema({
	name: String,
	quantity: Number,
	product_ID: Number,
	low_def: Number,
	cost_price: Number,
	retail_price: Number,
	prescription: Boolean,
})
const salesSchema = new mongoose.Schema({
	Sale_ID: Number,
	product_ID: Number,
	NumberSold: Number,
	DateOfSale: Date,
})

// access the collections in Atlas
const Product = mongoose.model('Products', productsSchema)
const Sales = mongoose.model('Sales', salesSchema)

// ======================= Login & Logout =======================
// Login Information
app.post('/login_request', (req, res) => {
	User = req.body.UserName
	Pass = req.body.Password
	authUser = 'User'
	authPass = 'Swinburne1234'
	if (User == authUser && Pass == authPass) {
		res.render('contents', { title: 'Home' })
	} else {
		res.render('index', { title: 'Home' })
	}
})

app.get('/LogOut', (req, res) => {
	res.render('LogOut')
})

// ======================= Sales routes =======================
// adding a sale record
app.post('/sales/add', (req, res) => {
	const prodID = parseInt(req.body.ItemCode)
	const saleQTY = parseInt(req.body.SaleQuantity)
	const saleDATE = parseInt(req.body.SaleDate)
	let prodIDExists = false
	let validQTY = false
	let currentProduct = {}

	productsFind()
	function productsFind() {
		validQTY = false
		Product.find((err, products) => {
			if (err) {
				console.log(err)
			} else {
				for (var i = 0; i < products.length; i++) {
					prodIDExists = false
					validQTY = false
					if (products[i].product_ID == prodID) {
						currentProduct = products[i]
						prodIDExists = true
					}
					if (products[i].quantity >= saleQTY) {
						validQTY = true
					}
					if (prodIDExists && validQTY) {
						addSale()
					}
				}
			}
		})
	}

	async function addSale() {
		let maxID = 0
		const sales = await Sales.find({})
		for (var i = 0; i < sales.length; i++) {
			if (sales[i].Sale_ID > maxID) {
				maxID = sales[i].Sale_ID
			}
		}

		const sale = new Sales({
			Sale_ID: ++maxID,
			product_ID: prodID,
			NumberSold: saleQTY,
			DateOfSale: mongoose.now(), // Just using current date until I can figure out a way to do this.
		})

		sale.save()
		Product.updateOne(
			{ product_ID: sale.product_ID },
			{ quantity: currentProduct.quantity - sale.NumberSold },
			(err) => {
				if (err) {
					console.log(err)
				} else {
					console.log(
						'Updated Product ID ' &
							sale.product_ID &
							"'s quantity to " &
							(currentProduct.quantity - sale.NumberSold)
					)
				}
			}
		)
		res.redirect('/sales/display')
	}
})

// Display sales in table
app.get('/sales/display', async (req, res) => {
	const sales = await Sales.find({})
	res.render('displaySales', { sales })
})
// End of display sales

// Edit Sales
app.get('/sales/edit/:id', async (req, res) => {
	const sales = await Sales.findById(req.params.id)
	res.render('editSales', { sales })
})

app.put('/sales/:id', async (req, res) => {
	const sales = await Sales.findByIdAndUpdate(req.params.id, { ...req.body.sales })
	res.redirect('/sales/display')
})
// End of edit sales

app.get('/sales/menu', (req, res) => {
	res.render('salesMenu')
})
app.get('/sales/add', (req, res) => {
	res.render('addSales')
})

app.delete('/sales/:id', async (req, res) => {
	const { id } = req.params
	await Sales.findByIdAndDelete(id)
	res.redirect('back')
})

// ======================= Items routes =======================

app.get('/item/menu', (req, res) => {
	res.render('itemMenu')
})

app.get('/item/add', async (req, res) => {
	res.render('addItem')
})

app.post('/item', async (req, res) => {
	const item = req.body.item
	const items = await Product.find({})

	let maxID = 0
	for (var i = 0; i < items.length; i++) {
		if (items[i].product_ID > maxID) {
			maxID = items[i].product_ID
		}
	}

	const newItem = new Product({
		...item,
		prescription: item.prescription === 'on' ? true : false,
		quantity: parseInt(item.quantity),
		product_ID: parseInt(++maxID),
		low_def: parseInt(item.low_def),
		cost_price: parseInt(item.cost_price),
		retail_price: parseInt(item.retail_price),
	})
	await newItem.save()
	res.redirect(200, '/item/add')
})

app.get('/item/display', async (req, res) => {
	const items = await Product.find({})
	res.render('displayItems', { items })
})

app.get('/item/edit/:id', async (req, res) => {
	item = await Product.findById(req.params.id)
	res.render('editItem', { item })
})

app.put('/item/:id', async (req, res) => {
	const item = {
		...req.body.item,
		prescription: req.body.item.prescription === 'on' ? true : false,
	}
	await Product.findByIdAndUpdate(req.params.id, item)
	res.redirect('/item/display')
})

app.delete('/item/:id', async (req, res) => {
	const { id } = req.params
	await Product.findByIdAndDelete(id)
	res.redirect('back')
})

// ======================= Report Generation Routes =======================

app.get('/report/monthly', async (req, res) => {
	const sales = await Sales.find({})

	let currentDate = new Date()
	let monthAgo = new Date()
	monthAgo = monthAgo.setDate(monthAgo.getDate() - 30)

	let salesCSV = []
	for (sale of sales) {
		if (monthAgo < sale.DateOfSale && currentDate > sale.DateOfSale) {
			salesCSV.push({
				sale: sale.Sale_ID,
				product: sale.product_ID,
				sold: sale.NumberSold,
				date: sale.DateOfSale,
			})
		}
	}
	let data = `monthly-${currentDate.getFullYear()}-${
		currentDate.getMonth() + 1
	}-${currentDate.getDate()}`
	var ws = fs.createWriteStream(`./data/month/${data}.csv`)
	fastcsv.write(salesCSV, { headers: true }).pipe(ws)

	res.send(
		`File has been downloaded. It can be find it under data/month/${data}.csv<br><a href="/report">Go Back</a>`
	)
})

app.get('/report/yearly', async (req, res) => {
	const sales = await Sales.find({})

	let currentDate = new Date()
	let yearAgo = new Date()
	yearAgo = yearAgo.setDate(yearAgo.getDate() - 365)

	let salesCSV = []
	for (sale of sales) {
		if (yearAgo < sale.DateOfSale && currentDate > sale.DateOfSale) {
			salesCSV.push({
				sale: sale.Sale_ID,
				product: sale.product_ID,
				sold: sale.NumberSold,
				date: sale.DateOfSale,
			})
		}
	}
	let data = `yearly-${currentDate.getFullYear()}-${
		currentDate.getMonth() + 1
	}-${currentDate.getDate()}`
	var ws = fs.createWriteStream(`./data/year/${data}.csv`)
	fastcsv.write(salesCSV, { headers: true }).pipe(ws)

	res.send(
		`File has been downloaded. It can be find it under data/year/${data}.csv<br><a href="/report">Go Back</a>`
	)
})

const getDashboardData = async (req, res, next) => {
	// Grab Data and Set Up Dates
	const sales = await Sales.find({})
	const products = await Product.find({})

	let now = new Date()
	let monthAgoDate = new Date()
	let yearAgoDate = new Date()
	monthAgoDate = monthAgoDate.setDate(monthAgoDate.getDate() - 30)
	yearAgoDate = yearAgoDate.setDate(yearAgoDate.getDate() - 365)

	// Grab data for month ago and year ago
	let monthAgoCSV = []
	let yearAgoCSV = []

	for (sale of sales) {
		if (monthAgoDate < sale.DateOfSale && now > sale.DateOfSale) {
			monthAgoCSV.push({
				Sale_ID: sale.Sale_ID,
				product_ID: sale.product_ID,
				NumberSold: sale.NumberSold,
				DateOfSale: sale.DateOfSale,
			})
			yearAgoCSV.push({
				Sale_ID: sale.Sale_ID,
				product_ID: sale.product_ID,
				NumberSold: sale.NumberSold,
				DateOfSale: sale.DateOfSale,
			})
		} else if (yearAgoDate < sale.DateOfSale && now > sale.DateOfSale) {
			yearAgoCSV.push({
				Sale_ID: sale.Sale_ID,
				product_ID: sale.product_ID,
				NumberSold: sale.NumberSold,
				DateOfSale: sale.DateOfSale,
			})
		}
	}

	// https://codesandbox.io/s/groupby-using-array-reduce-8zmi7?from-embed=&file=/src/index.js
	const groupBy = (array) => {
		return array.reduce((result, salesObject) => {
			;(result[salesObject.product_ID] = result[salesObject.product_ID] || []).push(salesObject)
			return result
		}, {})
	}

	// Group By Product
	const monthAgoGroupByNoOfSales = groupBy(monthAgoCSV)
	const yearAgoGroupByNoOfSales = groupBy(yearAgoCSV)

	// Get Total Sales Per Product for each
	req.monthSortByNoOfSales = await getAggregateNoOfSales(monthAgoGroupByNoOfSales)
	req.yearSortByNoOfSales = await getAggregateNoOfSales(yearAgoGroupByNoOfSales)
	// console.log(req.monthSortByNoOfSales)
	// console.log(req.yearSortByNoOfSales)

	// Get array of sales sorted by profit in ascending order
	req.monthSortByProfit = sortbyProfit(req.monthSortByNoOfSales)
	req.yearSortByProfit = sortbyProfit(req.yearSortByNoOfSales)
	// console.log(monthSortByProfit)
	// console.log(yearSortByProfit)

	async function getAggregateNoOfSales(object) {
		let array = []
		for (var i in object) {
			let sum = 0
			let dateOfSale
			for (var j = 0; j < object[i].length; j++) {
				sum += object[i][j].NumberSold
				dateOfSale = object[i][j].DateOfSale
			}
			array.push({
				productID: i,
				NumSold: sum,
				dateOfSale: dateOfSale,
			})
		}
		// sort array by number of items sold in ascending order
		array.sort((a, b) => {
			return a.NumSold - b.NumSold
		})
		await calculateProfit(array)
		return array
	}

	async function calculateProfit(salesArray) {
		for (let sales of salesArray) {
			// get product
			const product = await Product.findOne({ product_ID: sales.productID })
			// calculate profit: profit = (retail price - cost price) * number of items sold
			sales.profit = (product.retail_price - product.cost_price) * sales.NumSold
		}
	}

	function sortbyProfit(salesArray) {
		return salesArray.slice().sort((a, b) => {
			return a.profit - b.profit
		})
	}
	next()
}

app.get('/dashboard', (req, res) => {
	res.render('dashboard')
})

app.get('/dashboard/monthly', getDashboardData, async (req, res) => {
	const monthSortByNoOfSales = req.monthSortByNoOfSales
	// console.log(req.monthSortByNoOfSales)
	const monthSortByProfit = req.monthSortByProfit
	res.render('dashboardMonth', { monthSortByNoOfSales, monthSortByProfit })
})
app.get('/dashboard/yearly', getDashboardData, async (req, res) => {
	const yearSortByNoOfSales = req.yearSortByNoOfSales
	const yearSortByProfit = req.yearSortByProfit
	res.render('dashboardYear', { yearSortByNoOfSales, yearSortByProfit })
})

app.get('/report', (req, res) => {
	res.render('report')
})

app.get('/', (req, res) => {
	res.render('contents')
})

app.listen(PORT, () => {
	console.log('Server started on port 3000')
})
