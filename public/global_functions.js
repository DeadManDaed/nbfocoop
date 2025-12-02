

// Fonction générique pour insérer des données dans une table 

 async function submitFormToTable(formName, tableName, data) {
  const formElement = document.getElementById(formName);
  const submitButton = formElement.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;

  try {
    const response = await fetch(`/api/${tableName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    const result = await response.json();
    console.log('Réponse complète:', result);

    // Message succès
    submitButton.textContent = '✓ Succès !';
    submitButton.style.backgroundColor = '#10b981'; // vert
    submitButton.disabled = true;

    // Réinitialiser le formulaire
    formElement.reset();

    // Restaurer après 3 secondes
    setTimeout(() => {
      submitButton.textContent = originalText;
      submitButton.style.backgroundColor = '';
      submitButton.disabled = false;
    }, 3000);

  } catch (err) {
    console.error('Erreur:', err);

    // Message échec
    submitButton.textContent = '✗ Échec...';
    submitButton.style.backgroundColor = '#ef4444'; // rouge

    setTimeout(() => {
      submitButton.textContent = originalText;
      submitButton.style.backgroundColor = '';
    }, 3000);
  }
}


// Fonction générique pour mettre à jour une ligne

async function updateFormToTable(formName, tableName, idValue, data) {
  const formElement = document.getElementById(formName);
  const submitButton = formElement.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;

  try {
    const response = await fetch(`/api/${tableName}/${idValue}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    const result = await response.json();
    console.log('Réponse complète:', result);

    // Message succès
    submitButton.textContent = '✓ Mise à jour réussie !';
    submitButton.style.backgroundColor = '#10b981';
    submitButton.disabled = true;

    // Réinitialiser le formulaire
    formElement.reset();

    setTimeout(() => {
      submitButton.textContent = originalText;
      submitButton.style.backgroundColor = '';
      submitButton.disabled = false;
    }, 3000);

  } catch (err) {
    console.error('Erreur:', err);

    // Message échec
    submitButton.textContent = '✗ Échec mise à jour';
    submitButton.style.backgroundColor = '#ef4444';

    setTimeout(() => {
      submitButton.textContent = originalText;
      submitButton.style.backgroundColor = '';
    }, 3000);
  }
}


