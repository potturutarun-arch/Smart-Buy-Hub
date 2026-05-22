const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Path to data file
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Helper to read DB
const readDB = () => {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
};

// Helper to write DB
const writeDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// ============================
// API Endpoints
// ============================

// 1. Get all products
app.get('/api/products', (req, res) => {
    try {
        const db = readDB();
        res.json(db.products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// 2. Login endpoint (Mock Auth)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    try {
        const db = readDB();
        const user = db.users.find(u => (u.email === email || u.phone === email) && u.password === password);
        
        if (user) {
            // Return a mock token and user ID
            res.json({ success: true, token: 'mock-jwt-token-123', userId: user.id });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Get User Profile
app.get('/api/user/profile', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (user) {
            // Remove password before sending
            const { password, ...userProfile } = user;
            res.json(userProfile);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Forgot Password endpoint (Mock)
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    // In a real app, you would send an email with a reset token here.
    // We always return 200 OK to prevent email enumeration attacks.
    res.json({ success: true, message: 'If the email exists, a reset link was sent.' });
});

// 5. Signup endpoint
app.post('/api/signup', (req, res) => {
    const { name, email, phone, password } = req.body;
    
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        const db = readDB();
        
        // Check if user already exists
        const userExists = db.users.find(u => u.email === email || u.phone === phone);
        if (userExists) {
            return res.status(409).json({ success: false, error: 'User with this email or phone already exists' });
        }

        // Create new user
        const newUser = {
            id: Math.floor(1000000 + Math.random() * 9000000).toString(), // Generate random 7 digit ID
            email,
            phone,
            password,
            name,
            totalProfit: 5.00 // New users start with a 5 Rs welcome bonus!
        };

        db.users.push(newUser);
        writeDB(db);

        // Auto login after signup
        res.status(201).json({ success: true, token: 'mock-jwt-token-123', userId: newUser.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 6. Get User Orders
app.get('/api/user/orders', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const userOrders = db.orders ? db.orders.filter(o => o.userId === userId) : [];
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. Get User Reports (clicks & overall performance)
app.get('/api/user/reports', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const userClicks = db.clicks ? db.clicks.filter(c => c.userId === userId) : [];
        res.json(userClicks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. Submit Payment Request
app.post('/api/user/request-payment', (req, res) => {
    const { userId, amount, method, details } = req.body;
    if (!userId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'User ID, amount, and method are required' });
    }

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.totalProfit < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient earnings' });
        }

        // Deduct from totalProfit
        user.totalProfit = parseFloat((user.totalProfit - amount).toFixed(2));

        // Create payment transaction
        const newPayment = {
            id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
            userId,
            amount: parseFloat(amount),
            date: new Date().toISOString().split('T')[0],
            method: `${method} (${details})`,
            status: 'Pending',
            utr: 'Pending Approval'
        };

        if (!db.payments) db.payments = [];
        db.payments.unshift(newPayment); // Add to beginning of array
        writeDB(db);

        res.status(201).json({ success: true, message: 'Payment request submitted successfully', newBalance: user.totalProfit });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 9. Get User Payments History
app.get('/api/user/payments', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const userPayments = db.payments ? db.payments.filter(p => p.userId === userId) : [];
        res.json(userPayments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. Get User Referrals
app.get('/api/user/referrals', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const userReferrals = db.referrals ? db.referrals.filter(r => r.userId === userId) : [];
        res.json(userReferrals);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================
// ADMIN & OWNER API Endpoints
// ============================

// 11. Get Private Admin Stats (Total Owner Commission, etc.)
app.get('/api/admin/stats', (req, res) => {
    try {
        const db = readDB();
        const orders = db.orders || [];
        const payments = db.payments || [];

        const totalOrdersAmount = orders.reduce((sum, o) => sum + o.amount, 0);
        // Owner commission is 10% of total sales volume/order amount
        const ownerCommission = parseFloat((totalOrdersAmount * 0.10).toFixed(2));
        
        const totalPayouts = payments
            .filter(p => p.status === 'Transferred')
            .reduce((sum, p) => sum + p.amount, 0);

        res.json({
            totalOrdersAmount,
            ownerCommission,
            totalPayouts,
            ordersCount: orders.length,
            paymentsCount: payments.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 12. Get User Directory (Admin only view)
app.get('/api/admin/users', (req, res) => {
    try {
        const db = readDB();
        // Return user list (strip passwords for safety)
        const safeUsers = db.users.map(u => {
            const { password, ...safeUser } = u;
            return safeUser;
        });
        res.json(safeUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 12b. Get All Global Payouts (Admin only view)
app.get('/api/admin/payments', (req, res) => {
    try {
        const db = readDB();
        const payments = db.payments || [];
        res.json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 13. Process Owner-Operated Payout
app.post('/api/admin/process-payout', (req, res) => {
    const { userId, amount, method, details } = req.body;
    if (!userId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'User ID, amount, and method are required' });
    }

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const payoutAmt = parseFloat(amount);
        if (user.totalProfit < payoutAmt) {
            return res.status(400).json({ success: false, error: 'Insufficient user balance' });
        }

        // Deduct from user balance
        user.totalProfit = parseFloat((user.totalProfit - payoutAmt).toFixed(2));

        // Create random UTR number
        const randomUTR = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString();

        // Create payment record
        const newPayment = {
            id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
            userId,
            amount: payoutAmt,
            date: new Date().toISOString().split('T')[0],
            method: `${method} (${details || 'Direct Payout'})`,
            status: 'Transferred',
            utr: randomUTR
        };

        if (!db.payments) db.payments = [];
        db.payments.unshift(newPayment);
        writeDB(db);

        res.status(201).json({ 
            success: true, 
            message: 'Payout processed successfully', 
            newBalance: user.totalProfit,
            payment: newPayment
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 14. Get User Financial Breakdown (5 buckets for reports.html)
app.get('/api/user/financial-breakdown', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userOrders = db.orders ? db.orders.filter(o => o.userId === userId) : [];
        const userPayments = db.payments ? db.payments.filter(p => p.userId === userId) : [];

        // 1. Pending (profits of orders with status 'Pending')
        const pending = parseFloat(userOrders.filter(o => o.status === 'Pending').reduce((sum, o) => sum + o.profit, 0).toFixed(2));
        
        // 2. Confirmed (currently withdrawable wallet balance)
        const confirmed = parseFloat(user.totalProfit.toFixed(2));
        
        // 3. Paid (sum of all successfully transferred payments)
        const paid = parseFloat(userPayments.filter(p => p.status === 'Transferred').reduce((sum, p) => sum + p.amount, 0).toFixed(2));
        
        // 4. Requested (legacy or administrative pending payouts, normally 0 now)
        const requested = parseFloat(userPayments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0).toFixed(2));
        
        // 5. Cancelled (profits of cancelled orders)
        const cancelled = parseFloat(userOrders.filter(o => o.status === 'Cancelled').reduce((sum, o) => sum + o.profit, 0).toFixed(2));

        // All Time Total Profit = Confirmed Balance + Paid Payouts + Pending Earnings
        const allTimeTotalProfit = parseFloat((confirmed + paid + pending).toFixed(2));

        res.json({
            pending,
            confirmed,
            paid,
            requested,
            cancelled,
            allTimeTotalProfit
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 15. Change User Password
app.post('/api/user/change-password', (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'User ID, current password, and new password are required' });
    }

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (user.password !== currentPassword) {
            return res.status(401).json({ success: false, error: 'Incorrect current password' });
        }

        // Update password
        user.password = newPassword;
        writeDB(db);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 16. Update User Profile
app.post('/api/user/update-profile', (req, res) => {
    const { userId, name, email, phone } = req.body;
    if (!userId || !name || !email || !phone) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check if email or phone is already taken by another user
        const duplicate = db.users.find(u => u.id !== userId && (u.email === email || u.phone === phone));
        if (duplicate) {
            return res.status(409).json({ success: false, error: 'Email or phone number is already registered by another user' });
        }

        // Update details
        user.name = name;
        user.email = email;
        user.phone = phone;

        writeDB(db);
        res.json({ 
            success: true, 
            message: 'Profile updated successfully', 
            user: { id: user.id, name: user.name, email: user.email, phone: user.phone } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 17. Register New Affiliate Smart Link
app.post('/api/user/create-link', (req, res) => {
    const { userId, url, title, retailer } = req.body;
    if (!userId || !url || !title || !retailer) {
        return res.status(400).json({ success: false, error: 'User ID, URL, Title, and Retailer are required' });
    }

    try {
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const newLink = {
            id: 'CLK' + Math.floor(10000 + Math.random() * 90000).toString(),
            userId,
            url,
            title,
            retailer,
            clicks: 0,
            earnings: 0
        };

        if (!db.clicks) db.clicks = [];
        db.clicks.push(newLink);
        writeDB(db);

        res.status(201).json({ success: true, message: 'Smart Link created successfully', link: newLink });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 18. Affiliate Smart Link Tracking Redirect & Purchase Simulator
app.get('/link/:linkId', (req, res) => {
    const { linkId } = req.params;
    try {
        const db = readDB();
        const clickRecord = db.clicks ? db.clicks.find(c => c.id === linkId) : null;
        
        if (!clickRecord) {
            return res.status(404).send('<h1>Link Not Found</h1><p>The affiliate link you followed is invalid or has expired.</p>');
        }

        // 1. Increment clicks
        clickRecord.clicks = (clickRecord.clicks || 0) + 1;

        // 2. Mock Affiliate Marketing Purchase Simulator (10% chance of successful txn)
        const mockChance = Math.random() < 0.10;
        if (mockChance) {
            const user = db.users.find(u => u.id === clickRecord.userId);
            if (user) {
                // Generate a random order amount (e.g. between 500 and 15000)
                const mockAmount = Math.floor(500 + Math.random() * 14500);
                // Profit is between 5% and 10% of order amount
                const commissionRate = 0.05 + Math.random() * 0.05;
                const mockProfit = parseFloat((mockAmount * commissionRate).toFixed(2));

                // Add to user balance
                user.totalProfit = parseFloat((user.totalProfit + mockProfit).toFixed(2));

                // Add to link's overall earnings
                clickRecord.earnings = parseFloat(((clickRecord.earnings || 0) + mockProfit).toFixed(2));

                // Create a simulated order record
                const newOrder = {
                    id: 'ORD' + Math.floor(10000 + Math.random() * 90000).toString(),
                    userId: clickRecord.userId,
                    retailer: clickRecord.retailer,
                    date: new Date().toISOString().split('T')[0],
                    amount: mockAmount,
                    profit: mockProfit,
                    status: 'Confirmed'
                };

                if (!db.orders) db.orders = [];
                db.orders.unshift(newOrder);

                // Create a simulated payment record (Affiliate Commission credit)
                const newPayment = {
                    id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
                    userId: clickRecord.userId,
                    amount: mockProfit,
                    date: new Date().toISOString().split('T')[0],
                    method: `Affiliate Commission (${clickRecord.retailer})`,
                    status: 'Transferred',
                    utr: 'CTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString()
                };

                if (!db.payments) db.payments = [];
                db.payments.unshift(newPayment);
            }
        }

        writeDB(db);

        // Redirect to original URL
        let redirectUrl = clickRecord.url;
        if (!/^https?:\/\//i.test(redirectUrl)) {
            redirectUrl = 'http://' + redirectUrl;
        }
        res.redirect(redirectUrl);
    } catch (error) {
        console.error(error);
        res.status(500).send('<h1>Server Error</h1><p>Failed to process redirect.</p>');
    }
});

// Serve static frontend files (if run from the same dir)
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
