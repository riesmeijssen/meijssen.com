const apiKey = 'AIzaSyBRV9mXt9ohHWaZyYhiv5OWwww-NwUGXBU';
const spreadsheetId = '1Fkb7RvspPyu2-RSZGN7yEAv47NGCPTf94Ab3-3e4J6U';
const range = 'form_reactions!A1:H200';

const recipe_types = ["Ontbijt", "Lunch", "Tussendoortje", "Avondeten", "Toetje"]


async function fetchRecipes() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const recipes_raw = data.values; // Contains list of recipes

        console.log(recipes_raw);

        recipes = preprocessRecipes(recipes_raw);
        displayRecipes(recipes);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function preprocessRecipes(recipes) {
    let result = [];
    for (let i = 1; i < recipes.length; i++) {
        if (recipes[i].length < 7) {
            continue;
        }
        let recipe = recipes[i];
        let creator = recipe[1];
        let type = recipe[2];
        let ingredients = recipe[3];
        let instructions = recipe[4];
        let notes = recipe[5];
        let recipe_name = recipe[6];
        result.push({
            creator: creator,
            type: type,
            ingredients: ingredients,
            instructions: instructions,
            notes: notes,
            recipe_name: recipe_name
        });
    }
    return result;
}

function formatRecipe(recipe) {
    if (recipe.notes === "") {
        return `
            <div>
                <h3>Ingrediënten</h3>
                <p>${recipe.ingredients}</p>
                <h3>Instructies</h3>
                <p>${recipe.instructions}</p>
            </div>
        `;
    } else {
        return `
            <div>
                <h3>Ingrediënten</h3>
                <p>${recipe.ingredients}</p>
                <h3>Instructies</h3>
                <p>${recipe.instructions}</p>
                <h3>Opmerkingen</h3>
                <p>${recipe.notes}</p>
            </div>
        `;
    }
}

function displayRecipes(recipes) {
    const recipeList = document.getElementById('recipe-list');

    recipe_types.forEach(type => {
        recipeList.innerHTML += `<h2>${type}</h2>`;
        recipes.forEach(recipe => {
            if (recipe.type !== type) {
                return;
            }
            // Create collapsible for each recipe
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            const content = document.createElement('p');

            summary.textContent = recipe.recipe_name + " - " + recipe.creator;
            content.innerHTML = formatRecipe(recipe);

            details.appendChild(summary);
            details.appendChild(content);
            recipeList.appendChild(details);
        });
    });

    recipeList.innerHTML += `<h2>Overige</h2>`;
    recipes.forEach(recipe => {
        if (!recipe_types.includes(recipe.type)) {
            // Create collapsible for each recipe
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            const content = document.createElement('p');

            summary.textContent = recipe.recipe_name + " (" + recipe.type + ")" + " - " + recipe.creator;
            content.innerHTML = formatRecipe(recipe);

            details.appendChild(summary);
            details.appendChild(content);
            recipeList.appendChild(details);
        }
    });
}

// Fetch and display recipes on page load
fetchRecipes();