import { generateContrat } from './generateContrat.js';

/**
 * Script de test pour vérifier le bon fonctionnement des générateurs
 */

async function testGenerateContrat() {
  console.log('🧪 Test génération contrat...');
  
  // IDs de test - remplacez par de vrais IDs de votre base
  const testData = {
    contratId: '6bfe14bc-814f-4f48-8c9e-2c5eeaeb20c1',
    consommateurId: '39736eee-c670-46ce-9832-b72667a10f64',
    producteurId: '50e8bfbd-2cec-4095-a259-a9cb352124e8',
    installationId: 'f3dbbb55-b25f-4671-a42f-e9e3502e1075'
  };

  try {
    const result = await generateContrat(
      testData.contratId,
      testData.consommateurId,
      testData.producteurId,
      testData.installationId
    );
    
    console.log('✅ Test contrat réussi:', result);
    return true;
  } catch (error) {
    console.error('❌ Test contrat échoué:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Démarrage des tests...\n');
  
  const results = {
    contrat: await testGenerateContrat(),
   
  };
  
  console.log('\n📊 Résultats des tests:');
  console.log(`Contrat: ${results.contrat ? '✅' : '❌'}`);
    
  const allPassed = Object.values(results).every(result => result);
  console.log(`\n${allPassed ? '🎉 Tous les tests sont passés!' : '⚠️ Certains tests ont échoué'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Exécuter les tests
runAllTests();