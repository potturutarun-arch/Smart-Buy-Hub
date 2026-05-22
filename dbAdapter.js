// SmartBuyHub Database Adapter Layer
// Handles transparent switching between Local JSON and Supabase Cloud Database

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Initialize state
let useSupabase = false;
let supabase = null;

// Grab credentials from env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'YOUR_SUPABASE_URL_HERE' && supabaseKey !== 'YOUR_SUPABASE_KEY_HERE') {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        useSupabase = true;
        console.log('\n==================================================');
        console.log('⚡ Supabase cloud database credentials detected!');
        console.log(`🔗 Connecting to: ${supabaseUrl}`);
        console.log('==================================================\n');
    } catch (err) {
        console.error('Failed to initialize Supabase client:', err.message);
        console.log('⚠️ Falling back to local file-sync database mode.');
        useSupabase = false;
    }
} else {
    console.log('\n==================================================');
    console.log('ℹ️ Running database in local file-sync mode.');
    console.log('💡 Configure SUPABASE_URL and SUPABASE_KEY in .env for persistent cloud storage.');
    console.log('==================================================\n');
}

// ----------------------------------------------------
// LOCAL DB HELPER METHODS (JSON filesystem)
// ----------------------------------------------------
const readLocalDB = () => {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
};

const writeLocalDB = (data) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// ----------------------------------------------------
// MIGRATION & SEEDING ROUTINE
// ----------------------------------------------------
const initializeDatabase = async () => {
    if (!useSupabase) return;

    try {
        // Test query to check if 'users' table exists and if database has records
        const { data: users, error } = await supabase.from('users').select('id').limit(1);

        if (error) {
            console.error('\n❌ ERROR: Supabase connection failed or tables do not exist.');
            console.error('Message:', error.message);
            console.log('👉 ACTION REQUIRED: Please copy the contents of "data/schema.sql"');
            console.log('   into your Supabase SQL Editor and click "Run" to initialize tables.\n');
            return;
        }

        // If 'users' table is empty, trigger the automatic migration/seed
        const { count, error: countError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Failed to count users in Supabase:', countError.message);
            return;
        }

        if (count === 0) {
            console.log('🌱 Supabase database is connected but empty.');
            console.log('🌱 Seeding Supabase cloud tables with local database records...');

            const localDb = readLocalDB();

            // 1. Seed Users
            if (localDb.users && localDb.users.length > 0) {
                console.log(`   - Seeding ${localDb.users.length} users...`);
                const { error: seedErr } = await supabase.from('users').insert(localDb.users);
                if (seedErr) console.error('     ❌ Error seeding users:', seedErr.message);
            }

            // 2. Seed Products
            if (localDb.products && localDb.products.length > 0) {
                console.log(`   - Seeding ${localDb.products.length} products...`);
                // Format numeric IDs to numbers for safety
                const formattedProducts = localDb.products.map(p => ({
                    ...p,
                    id: Number(p.id),
                    originalPrice: Number(p.originalPrice),
                    discountPrice: Number(p.discountPrice)
                }));
                const { error: seedErr } = await supabase.from('products').insert(formattedProducts);
                if (seedErr) console.error('     ❌ Error seeding products:', seedErr.message);
            }

            // 3. Seed Orders
            if (localDb.orders && localDb.orders.length > 0) {
                console.log(`   - Seeding ${localDb.orders.length} orders...`);
                const formattedOrders = localDb.orders.map(o => ({
                    ...o,
                    amount: Number(o.amount),
                    profit: Number(o.profit)
                }));
                const { error: seedErr } = await supabase.from('orders').insert(formattedOrders);
                if (seedErr) console.error('     ❌ Error seeding orders:', seedErr.message);
            }

            // 4. Seed Payments
            if (localDb.payments && localDb.payments.length > 0) {
                console.log(`   - Seeding ${localDb.payments.length} payments...`);
                const formattedPayments = localDb.payments.map(p => ({
                    ...p,
                    amount: Number(p.amount)
                }));
                const { error: seedErr } = await supabase.from('payments').insert(formattedPayments);
                if (seedErr) console.error('     ❌ Error seeding payments:', seedErr.message);
            }

            // 5. Seed Clicks
            if (localDb.clicks && localDb.clicks.length > 0) {
                console.log(`   - Seeding ${localDb.clicks.length} click tracking records...`);
                const formattedClicks = localDb.clicks.map(c => ({
                    ...c,
                    clicks: Number(c.clicks || 0),
                    earnings: Number(c.earnings || 0)
                }));
                const { error: seedErr } = await supabase.from('clicks').insert(formattedClicks);
                if (seedErr) console.error('     ❌ Error seeding clicks:', seedErr.message);
            }

            // 6. Seed Referrals
            if (localDb.referrals && localDb.referrals.length > 0) {
                console.log(`   - Seeding ${localDb.referrals.length} referral records...`);
                const formattedReferrals = localDb.referrals.map(r => ({
                    ...r,
                    earningsContribution: Number(r.earningsContribution || 0)
                }));
                const { error: seedErr } = await supabase.from('referrals').insert(formattedReferrals);
                if (seedErr) console.error('     ❌ Error seeding referrals:', seedErr.message);
            }

            console.log('✅ Supabase cloud database seeding complete!\n');
        } else {
            console.log(`✅ Supabase database online and verified. (${count} users registered)\n`);
        }
    } catch (err) {
        console.error('Failed to run database bootstrap check:', err.message);
    }
};

// Run initialize check on file load
setTimeout(initializeDatabase, 100);

// ----------------------------------------------------
// DATABASE API ADAPTER IMPLEMENTATION
// ----------------------------------------------------
const dbAdapter = {
    // Check mode
    isCloudMode: () => useSupabase,

    // 1. Get all products
    getProducts: async () => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.products || [];
        }
    },

    // 2. Find user by email or phone (for login and password reset)
    findUserByEmailOrPhone: async (emailOrPhone) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .or(`email.eq."${emailOrPhone}",phone.eq."${emailOrPhone}"`)
                .maybeSingle();
            if (error) throw new Error(error.message);
            return data;
        } else {
            const db = readLocalDB();
            return db.users.find(u => u.email === emailOrPhone || u.phone === emailOrPhone);
        }
    },

    // 3. Find user by ID
    getUserById: async (userId) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw new Error(error.message);
            return data;
        } else {
            const db = readLocalDB();
            return db.users.find(u => u.id === userId);
        }
    },

    // 4. Insert user
    insertUser: async (user) => {
        if (useSupabase) {
            const formattedUser = {
                ...user,
                totalProfit: Number(user.totalProfit || 5.00)
            };
            const { data, error } = await supabase
                .from('users')
                .insert(formattedUser)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        } else {
            const db = readLocalDB();
            db.users.push(user);
            writeLocalDB(db);
            return user;
        }
    },

    // 5. Update user profile
    updateUserProfile: async (userId, name, email, phone) => {
        if (useSupabase) {
            // Check duplicates first
            const { data: duplicate, error: dupError } = await supabase
                .from('users')
                .select('id')
                .neq('id', userId)
                .or(`email.eq."${email}",phone.eq."${phone}"`)
                .limit(1);
            
            if (dupError) throw new Error(dupError.message);
            if (duplicate && duplicate.length > 0) {
                const err = new Error('Email or phone number is already registered');
                err.code = '409';
                throw err;
            }

            const { data, error } = await supabase
                .from('users')
                .update({ name, email, phone })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            const duplicate = db.users.find(u => u.id !== userId && (u.email === email || u.phone === phone));
            if (duplicate) {
                const err = new Error('Email or phone number is already registered');
                err.code = '409';
                throw err;
            }

            user.name = name;
            user.email = email;
            user.phone = phone;
            writeLocalDB(db);
            return user;
        }
    },

    // 6. Reset password via OTP flow
    resetPassword: async (email, newPassword) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({ password: newPassword })
                .eq('email', email)
                .select();
            if (error) throw new Error(error.message);
            if (!data || data.length === 0) throw new Error('User not found');
            return true;
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.email === email);
            if (!user) throw new Error('User not found');
            user.password = newPassword;
            writeLocalDB(db);
            return true;
        }
    },

    // 7. Get user orders
    getOrdersByUserId: async (userId) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('userId', userId)
                .order('date', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.orders ? db.orders.filter(o => o.userId === userId) : [];
        }
    },

    // 8. Get user reports/clicks
    getClicksByUserId: async (userId) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('clicks')
                .select('*')
                .eq('userId', userId)
                .order('clicks', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.clicks ? db.clicks.filter(c => c.userId === userId) : [];
        }
    },

    // 9. Submit UPI/Bank Payment Request
    requestPayment: async (userId, amount, method, details) => {
        if (useSupabase) {
            // Fetch current user details
            const { data: user, error: userErr } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (userErr || !user) throw new Error('User not found');
            if (Number(user.totalProfit) < Number(amount)) throw new Error('Insufficient earnings');

            const newBalance = Number((Number(user.totalProfit) - Number(amount)).toFixed(2));

            // Deduct user balance
            const { error: updateErr } = await supabase
                .from('users')
                .update({ totalProfit: newBalance })
                .eq('id', userId);
            
            if (updateErr) throw new Error(updateErr.message);

            // Create payment record
            const newPayment = {
                id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
                userId,
                amount: Number(amount),
                date: new Date().toISOString().split('T')[0],
                method: `${method} (${details})`,
                status: 'Pending',
                utr: 'Pending Approval'
            };

            const { error: insertErr } = await supabase
                .from('payments')
                .insert(newPayment);
            
            if (insertErr) throw new Error(insertErr.message);

            return { newBalance, newPayment };
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');
            if (user.totalProfit < amount) throw new Error('Insufficient earnings');

            user.totalProfit = parseFloat((user.totalProfit - amount).toFixed(2));

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
            db.payments.unshift(newPayment);
            writeLocalDB(db);

            return { newBalance: user.totalProfit, newPayment };
        }
    },

    // 10. Get user payments history
    getPaymentsByUserId: async (userId) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('userId', userId)
                .order('date', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.payments ? db.payments.filter(p => p.userId === userId) : [];
        }
    },

    // 11. Get user referrals
    getReferralsByUserId: async (userId) => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('referrals')
                .select('*')
                .eq('userId', userId)
                .order('dateJoined', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.referrals ? db.referrals.filter(r => r.userId === userId) : [];
        }
    },

    // 12. Get private admin stats
    getAdminStats: async () => {
        if (useSupabase) {
            const { data: orders, error: oError } = await supabase.from('orders').select('amount');
            const { data: payments, error: pError } = await supabase.from('payments').select('amount, status');

            if (oError) throw new Error(oError.message);
            if (pError) throw new Error(pError.message);

            const totalOrdersAmount = (orders || []).reduce((sum, o) => sum + Number(o.amount), 0);
            const ownerCommission = parseFloat((totalOrdersAmount * 0.10).toFixed(2));
            
            const totalPayouts = (payments || [])
                .filter(p => p.status === 'Transferred')
                .reduce((sum, p) => sum + Number(p.amount), 0);

            return {
                totalOrdersAmount,
                ownerCommission,
                totalPayouts,
                ordersCount: (orders || []).length,
                paymentsCount: (payments || []).length
            };
        } else {
            const db = readLocalDB();
            const orders = db.orders || [];
            const payments = db.payments || [];

            const totalOrdersAmount = orders.reduce((sum, o) => sum + o.amount, 0);
            const ownerCommission = parseFloat((totalOrdersAmount * 0.10).toFixed(2));
            
            const totalPayouts = payments
                .filter(p => p.status === 'Transferred')
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                totalOrdersAmount,
                ownerCommission,
                totalPayouts,
                ordersCount: orders.length,
                paymentsCount: payments.length
            };
        }
    },

    // 13. Get user directory (Admin view)
    getAllUsers: async () => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('id, email, phone, name, "totalProfit"')
                .order('name', { ascending: true });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.users.map(u => {
                const { password, ...safeUser } = u;
                return safeUser;
            });
        }
    },

    // 14. Get all global payouts (Admin view)
    getAllPayments: async () => {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .order('date', { ascending: false });
            if (error) throw new Error(error.message);
            return data || [];
        } else {
            const db = readLocalDB();
            return db.payments || [];
        }
    },

    // 15. Process Admin Payout
    processAdminPayout: async (userId, amount, method, details) => {
        if (useSupabase) {
            const { data: user, error: uError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (uError || !user) throw new Error('User not found');
            const payoutAmt = Number(amount);
            if (Number(user.totalProfit) < payoutAmt) throw new Error('Insufficient user balance');

            const newBalance = Number((Number(user.totalProfit) - payoutAmt).toFixed(2));

            // Deduct user balance
            const { error: updateErr } = await supabase
                .from('users')
                .update({ totalProfit: newBalance })
                .eq('id', userId);
            
            if (updateErr) throw new Error(updateErr.message);

            const randomUTR = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString();
            const newPayment = {
                id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
                userId,
                amount: payoutAmt,
                date: new Date().toISOString().split('T')[0],
                method: `${method} (${details || 'Direct Payout'})`,
                status: 'Transferred',
                utr: randomUTR
            };

            // Insert payout transaction
            const { error: pError } = await supabase.from('payments').insert(newPayment);
            if (pError) throw new Error(pError.message);

            return { newBalance, payment: newPayment };
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            const payoutAmt = parseFloat(amount);
            if (user.totalProfit < payoutAmt) throw new Error('Insufficient user balance');

            user.totalProfit = parseFloat((user.totalProfit - payoutAmt).toFixed(2));
            const randomUTR = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString();
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
            writeLocalDB(db);

            return { newBalance: user.totalProfit, payment: newPayment };
        }
    },

    // 16. Get user financial breakdown
    getUserFinancialBreakdown: async (userId) => {
        if (useSupabase) {
            const { data: user, error: uErr } = await supabase.from('users').select('*').eq('id', userId).single();
            if (uErr || !user) throw new Error('User not found');

            const { data: orders, error: oErr } = await supabase.from('orders').select('*').eq('userId', userId);
            const { data: payments, error: pErr } = await supabase.from('payments').select('*').eq('userId', userId);

            if (oErr) throw new Error(oErr.message);
            if (pErr) throw new Error(pErr.message);

            const pending = parseFloat((orders || []).filter(o => o.status === 'Pending').reduce((sum, o) => sum + Number(o.profit), 0).toFixed(2));
            const confirmed = parseFloat(Number(user.totalProfit).toFixed(2));
            const paid = parseFloat((payments || []).filter(p => p.status === 'Transferred').reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2));
            const requested = parseFloat((payments || []).filter(p => p.status === 'Pending').reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2));
            const cancelled = parseFloat((orders || []).filter(o => o.status === 'Cancelled').reduce((sum, o) => sum + Number(o.profit), 0).toFixed(2));
            const allTimeTotalProfit = parseFloat((confirmed + paid + pending).toFixed(2));

            return { pending, confirmed, paid, requested, cancelled, allTimeTotalProfit };
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            const userOrders = db.orders ? db.orders.filter(o => o.userId === userId) : [];
            const userPayments = db.payments ? db.payments.filter(p => p.userId === userId) : [];

            const pending = parseFloat(userOrders.filter(o => o.status === 'Pending').reduce((sum, o) => sum + o.profit, 0).toFixed(2));
            const confirmed = parseFloat(user.totalProfit.toFixed(2));
            const paid = parseFloat(userPayments.filter(p => p.status === 'Transferred').reduce((sum, p) => sum + p.amount, 0).toFixed(2));
            const requested = parseFloat(userPayments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0).toFixed(2));
            const cancelled = parseFloat(userOrders.filter(o => o.status === 'Cancelled').reduce((sum, o) => sum + o.profit, 0).toFixed(2));
            const allTimeTotalProfit = parseFloat((confirmed + paid + pending).toFixed(2));

            return { pending, confirmed, paid, requested, cancelled, allTimeTotalProfit };
        }
    },

    // 17. Change user password
    changePassword: async (userId, currentPassword, newPassword) => {
        if (useSupabase) {
            const { data: user, error: uError } = await supabase.from('users').select('*').eq('id', userId).single();
            if (uError || !user) throw new Error('User not found');
            if (user.password !== currentPassword) throw new Error('Incorrect current password');

            const { error: updateErr } = await supabase
                .from('users')
                .update({ password: newPassword })
                .eq('id', userId);
            
            if (updateErr) throw new Error(updateErr.message);
            return true;
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');
            if (user.password !== currentPassword) throw new Error('Incorrect current password');

            user.password = newPassword;
            writeLocalDB(db);
            return true;
        }
    },

    // 18. Register smart link
    createLink: async (userId, url, title, retailer) => {
        const newLink = {
            id: 'CLK' + Math.floor(10000 + Math.random() * 90000).toString(),
            userId,
            url,
            title,
            retailer,
            clicks: 0,
            earnings: 0
        };

        if (useSupabase) {
            const { data: user, error: uErr } = await supabase.from('users').select('id').eq('id', userId).single();
            if (uErr || !user) throw new Error('User not found');

            const { error } = await supabase.from('clicks').insert(newLink);
            if (error) throw new Error(error.message);
            return newLink;
        } else {
            const db = readLocalDB();
            const user = db.users.find(u => u.id === userId);
            if (!user) throw new Error('User not found');

            if (!db.clicks) db.clicks = [];
            db.clicks.push(newLink);
            writeLocalDB(db);
            return newLink;
        }
    },

    // 19. Handle Link click, increment click count, simulate potential marketing purchase
    handleLinkClick: async (linkId) => {
        if (useSupabase) {
            const { data: clickRecord, error: cErr } = await supabase
                .from('clicks')
                .select('*')
                .eq('id', linkId)
                .single();
            
            if (cErr || !clickRecord) return null;

            // Increment clicks count
            const newClickCount = Number(clickRecord.clicks || 0) + 1;
            const { error: updError } = await supabase
                .from('clicks')
                .update({ clicks: newClickCount })
                .eq('id', linkId);
            
            if (updError) throw new Error(updError.message);

            // Simulated purchase check
            const mockChance = Math.random() < 0.10;
            if (mockChance) {
                const { data: user, error: uErr } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', clickRecord.userId)
                    .single();
                
                if (user) {
                    const mockAmount = Math.floor(500 + Math.random() * 14500);
                    const commissionRate = 0.05 + Math.random() * 0.05;
                    const mockProfit = parseFloat((mockAmount * commissionRate).toFixed(2));

                    // Add user balance
                    const newUserProfit = Number((Number(user.totalProfit) + mockProfit).toFixed(2));
                    await supabase.from('users').update({ totalProfit: newUserProfit }).eq('id', user.id);

                    // Add click earnings
                    const newLinkEarnings = Number((Number(clickRecord.earnings) + mockProfit).toFixed(2));
                    await supabase.from('clicks').update({ earnings: newLinkEarnings }).eq('id', linkId);

                    // Create order
                    const newOrder = {
                        id: 'ORD' + Math.floor(10000 + Math.random() * 90000).toString(),
                        userId: clickRecord.userId,
                        retailer: clickRecord.retailer,
                        date: new Date().toISOString().split('T')[0],
                        amount: mockAmount,
                        profit: mockProfit,
                        status: 'Confirmed'
                    };
                    await supabase.from('orders').insert(newOrder);

                    // Create payment
                    const newPayment = {
                        id: 'TXN' + Math.floor(10000 + Math.random() * 90000).toString(),
                        userId: clickRecord.userId,
                        amount: mockProfit,
                        date: new Date().toISOString().split('T')[0],
                        method: `Affiliate Commission (${clickRecord.retailer})`,
                        status: 'Transferred',
                        utr: 'CTR' + Math.floor(100000000000 + Math.random() * 900000000000).toString()
                    };
                    await supabase.from('payments').insert(newPayment);
                }
            }

            return clickRecord.url;
        } else {
            const db = readLocalDB();
            const clickRecord = db.clicks ? db.clicks.find(c => c.id === linkId) : null;
            if (!clickRecord) return null;

            clickRecord.clicks = (clickRecord.clicks || 0) + 1;

            const mockChance = Math.random() < 0.10;
            if (mockChance) {
                const user = db.users.find(u => u.id === clickRecord.userId);
                if (user) {
                    const mockAmount = Math.floor(500 + Math.random() * 14500);
                    const commissionRate = 0.05 + Math.random() * 0.05;
                    const mockProfit = parseFloat((mockAmount * commissionRate).toFixed(2));

                    user.totalProfit = parseFloat((user.totalProfit + mockProfit).toFixed(2));
                    clickRecord.earnings = parseFloat(((clickRecord.earnings || 0) + mockProfit).toFixed(2));

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

            writeLocalDB(db);
            return clickRecord.url;
        }
    }
};

module.exports = dbAdapter;
