const express = require('express');
const cors = require('cors');
const path = require('path');
const dbAdapter = require('./dbAdapter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================
// API Endpoints
// ============================

// 1. Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await dbAdapter.getProducts();
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to read database' });
    }
});

// 2. Login endpoint (Mock Auth)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await dbAdapter.findUserByEmailOrPhone(email);
        
        if (user && user.password === password) {
            // Return a mock token and user ID
            res.json({ success: true, token: 'mock-jwt-token-123', userId: user.id });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. Get User Profile
app.get('/api/user/profile', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const user = await dbAdapter.getUserById(userId);
        if (user) {
            // Remove password before sending
            const { password, ...userProfile } = user;
            res.json(userProfile);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Forgot Password endpoint (Mock)
app.post('/api/forgot-password', (req, res) => {
    // In a real app, you would send an email with a reset token here.
    // We always return 200 OK to prevent email enumeration attacks.
    res.json({ success: true, message: 'If the email exists, a reset link was sent.' });
});

// 5. Signup endpoint
app.post('/api/signup', async (req, res) => {
    const { name, email, phone, password } = req.body;
    
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        // Check if user already exists
        const userExists = await dbAdapter.findUserByEmailOrPhone(email);
        const phoneExists = await dbAdapter.findUserByEmailOrPhone(phone);
        if (userExists || phoneExists) {
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

        await dbAdapter.insertUser(newUser);

        // Auto login after signup
        res.status(201).json({ success: true, token: 'mock-jwt-token-123', userId: newUser.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Active OTP store in memory
const activeOtps = {};

// 5a. Send OTP (SMS & Mail OTP Simulation)
app.post('/api/otp/send', async (req, res) => {
    const { email, phone } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    let userPhone = phone;
    const isSignup = !!phone;

    if (!isSignup) {
        try {
            const user = await dbAdapter.findUserByEmailOrPhone(email);
            if (!user) {
                return res.status(404).json({ success: false, error: 'No account registered with this email address. Please sign up first!' });
            }
            userPhone = user.phone;
        } catch (error) {
            console.error('Error searching user in db:', error);
            return res.status(500).json({ success: false, error: 'Server database error' });
        }
    }

    // Generate random 6 digit codes
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const smsOtp = userPhone ? Math.floor(100000 + Math.random() * 900000).toString() : null;

    // Save to memory
    activeOtps[email] = { emailOtp, smsOtp, expires: Date.now() + 5 * 60 * 1000 };

    // Print highlight in backend console for developer visibility
    console.log('\n==================================================');
    console.log(`📧 [EMAIL OTP] Sent to ${email} : ${emailOtp}`);
    if (userPhone && smsOtp) {
        console.log(`📲 [SMS OTP] Sent to ${userPhone} : ${smsOtp}`);
    }
    console.log('==================================================\n');

    res.json({ 
        success: true, 
        message: 'Verification codes successfully generated and sent!',
        emailOtp,
        smsOtp,
        phone: userPhone ? `******${userPhone.slice(-4)}` : null
    });
});

// 5b. Verify OTP
app.post('/api/otp/verify', (req, res) => {
    const { email, emailOtp, smsOtp } = req.body;
    if (!email || !emailOtp) {
        return res.status(400).json({ success: false, error: 'Email and Email OTP are required' });
    }

    const session = activeOtps[email];
    if (!session || Date.now() > session.expires) {
        return res.status(400).json({ success: false, error: 'OTP has expired or does not exist. Please request a new one.' });
    }

    // Accept static '123456' as developer master-bypass, or exact match
    const emailMatch = (emailOtp === '123456' || emailOtp === session.emailOtp);
    const smsMatch = !session.smsOtp || (smsOtp === '123456' || smsOtp === session.smsOtp);

    if (emailMatch && smsMatch) {
        // Clear OTP after successful verify
        delete activeOtps[email];
        res.json({ success: true, message: 'Verification successful!' });
    } else {
        res.status(400).json({ success: false, error: 'Incorrect verification codes. Please try again.' });
    }
});

// 5c. Reset Password via OTP Verification
app.post('/api/user/reset-password-otp', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and new password are required' });
    }
    try {
        await dbAdapter.resetPassword(email, password);
        res.json({ success: true, message: 'Password reset successfully!' });
    } catch(e) {
        console.error(e);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 6. Get User Orders
app.get('/api/user/orders', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const userOrders = await dbAdapter.getOrdersByUserId(userId);
        res.json(userOrders);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 7. Get User Reports (clicks & overall performance)
app.get('/api/user/reports', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const userClicks = await dbAdapter.getClicksByUserId(userId);
        res.json(userClicks);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 8. Submit Payment Request
app.post('/api/user/request-payment', async (req, res) => {
    const { userId, amount, method, details } = req.body;
    if (!userId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'User ID, amount, and method are required' });
    }

    try {
        const { newBalance } = await dbAdapter.requestPayment(userId, amount, method, details);
        res.status(201).json({ success: true, message: 'Payment request submitted successfully', newBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
});

// 9. Get User Payments History
app.get('/api/user/payments', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const userPayments = await dbAdapter.getPaymentsByUserId(userId);
        res.json(userPayments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// 10. Get User Referrals
app.get('/api/user/referrals', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const userReferrals = await dbAdapter.getReferralsByUserId(userId);
        res.json(userReferrals);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================
// ADMIN & OWNER API Endpoints
// ============================

// 11. Get Private Admin Stats (Total Owner Commission, etc.)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await dbAdapter.getAdminStats();
        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 12. Get User Directory (Admin only view)
app.get('/api/admin/users', async (req, res) => {
    try {
        const safeUsers = await dbAdapter.getAllUsers();
        res.json(safeUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 12b. Get All Global Payouts (Admin only view)
app.get('/api/admin/payments', async (req, res) => {
    try {
        const payments = await dbAdapter.getAllPayments();
        res.json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 13. Process Owner-Operated Payout
app.post('/api/admin/process-payout', async (req, res) => {
    const { userId, amount, method, details } = req.body;
    if (!userId || !amount || !method) {
        return res.status(400).json({ success: false, error: 'User ID, amount, and method are required' });
    }

    try {
        const { newBalance, payment } = await dbAdapter.processAdminPayout(userId, amount, method, details);
        res.status(201).json({ 
            success: true, 
            message: 'Payout processed successfully', 
            newBalance,
            payment
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
});

// 14. Get User Financial Breakdown (5 buckets for reports.html)
app.get('/api/user/financial-breakdown', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    try {
        const breakdown = await dbAdapter.getUserFinancialBreakdown(userId);
        res.json(breakdown);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 15. Change User Password
app.post('/api/user/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'User ID, current password, and new password are required' });
    }

    try {
        await dbAdapter.changePassword(userId, currentPassword, newPassword);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
});

// 16. Update User Profile
app.post('/api/user/update-profile', async (req, res) => {
    const { userId, name, email, phone } = req.body;
    if (!userId || !name || !email || !phone) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        const updatedUser = await dbAdapter.updateUserProfile(userId, name, email, phone);
        res.json({ 
            success: true, 
            message: 'Profile updated successfully', 
            user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone } 
        });
    } catch (error) {
        console.error(error);
        if (error.code === '409') {
            return res.status(409).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 17. Register New Affiliate Smart Link
app.post('/api/user/create-link', async (req, res) => {
    const { userId, url, title, retailer } = req.body;
    if (!userId || !url || !title || !retailer) {
        return res.status(400).json({ success: false, error: 'User ID, URL, Title, and Retailer are required' });
    }

    try {
        const link = await dbAdapter.createLink(userId, url, title, retailer);
        res.status(201).json({ success: true, message: 'Smart Link created successfully', link });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// 18. Affiliate Smart Link Tracking Redirect & Purchase Simulator
app.get('/link/:linkId', async (req, res) => {
    const { linkId } = req.params;
    try {
        const redirectUrl = await dbAdapter.handleLinkClick(linkId);
        
        if (!redirectUrl) {
            return res.status(404).send('<h1>Link Not Found</h1><p>The affiliate link you followed is invalid or has expired.</p>');
        }

        // Redirect to original URL
        let formattedUrl = redirectUrl;
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'http://' + formattedUrl;
        }
        res.redirect(formattedUrl);
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
