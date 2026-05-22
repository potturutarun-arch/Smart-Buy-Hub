// Integration Test for dbAdapter
// Run this to verify local file fallback and database functionality

const dbAdapter = require('../dbAdapter');

const runTests = async () => {
    console.log('🧪 Starting database adapter tests...');
    console.log(`📡 Current mode: ${dbAdapter.isCloudMode() ? '☁️ Supabase Cloud Mode' : '📂 Local File Fallback Mode'}\n`);

    try {
        // Test 1: Fetch products
        console.log('🔄 Test 1: Fetching products...');
        const products = await dbAdapter.getProducts();
        console.log(`   ✅ Success! Found ${products.length} products.`);
        if (products.length > 0) {
            console.log(`   - Sample Product: "${products[0].title}" by ${products[0].retailer}`);
        }

        // Test 2: Find user by email (using test email in db.json: test@example.com)
        const testEmail = 'test@example.com';
        console.log(`\n🔄 Test 2: Finding user by email: ${testEmail}...`);
        const user = await dbAdapter.findUserByEmailOrPhone(testEmail);
        if (user) {
            console.log(`   ✅ Success! Found user: "${user.name}" with wallet: Rs. ${user.totalProfit}`);
        } else {
            console.log('   ⚠️ Warning: Default test user not found. (Expected if db.json is customized)');
        }

        // Test 3: Get user referrals
        if (user) {
            console.log(`\n🔄 Test 3: Fetching referrals for user ${user.id}...`);
            const referrals = await dbAdapter.getReferralsByUserId(user.id);
            console.log(`   ✅ Success! Found ${referrals.length} referrals.`);
            
            console.log(`\n🔄 Test 4: Fetching financial breakdown for user ${user.id}...`);
            const breakdown = await dbAdapter.getUserFinancialBreakdown(user.id);
            console.log('   ✅ Success! Financial Breakdown:', JSON.stringify(breakdown, null, 2));
        }

        // Test 5: Create a new link
        const tempUserId = user ? user.id : '5301358';
        console.log(`\n🔄 Test 5: Creating a new Affiliate Smart Link for user ${tempUserId}...`);
        const link = await dbAdapter.createLink(
            tempUserId,
            'https://www.amazon.in/dp/B0BYTEST',
            'Adapter Test Smart Link',
            'Amazon'
        );
        console.log('   ✅ Success! Created link:', JSON.stringify(link, null, 2));

        // Test 6: Handle link click tracking
        console.log(`\n🔄 Test 6: Simulating click on link ${link.id}...`);
        const redirectUrl = await dbAdapter.handleLinkClick(link.id);
        console.log(`   ✅ Success! Link clicked. Redirecting to: ${redirectUrl}`);

        console.log('\n==================================================');
        console.log('🎉 ALL ADAPTER TESTS COMPLETED SUCCESSFULLY!');
        console.log('==================================================\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        process.exit(1);
    }
};

runTests();
