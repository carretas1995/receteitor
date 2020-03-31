/* cargo los modulos necesarios para las ventanas y menu de navegacion */
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
/* modulo carga de archivos/url */
const url = require('url');
const path = require('path');
/* modulo para leer/escribir archivos */
const fs = require('fs');

/* icono de la app */
const nativeImage = require('electron').nativeImage;
var image = nativeImage.createFromPath(__dirname + './img/icono.png'); 

/* variable global */
let mainWindow;
let newRecipeWindow;
let acercaDeWindow;

/* para recargar la aplicacion solo en produccion */
 /* if(process.env.NODE_ENV !== 'production') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron')
  });
}  */

/* al iniciar la aplicacion */
app.on('ready', () => {
  //creo la ventana principal
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: image
  });

  //cargo el archivo html principal
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'views/index.html'),
    protocol: 'file',
    slashes: true
  }))

  //cargo las notas guardadas
  loadDataRecipes()

  //para cargar el menu personalizado
  const mainMenu = Menu.buildFromTemplate(templateMenu);
  Menu.setApplicationMenu(mainMenu);

  //cuando cierro la ventana principal cierro todo
  mainWindow.on('closed', () => {
    app.quit();
  });

});

/* funcion que abre una ventana par ala nueva nota */
function createNewRecipe() {
  newRecipeWindow = new BrowserWindow({
    width: 703,
    height: 610,
    icon: image,
    title: 'Añadir nueva receta'
  });

  //quito el navbar
  newRecipeWindow.setMenu(null);

  //cargo el new-recipe.html
  newRecipeWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'views/new-recipe.html'),
    protocol: 'file',
    icon: image,
    slashes: true
  }));

  //cuando cierro la ventana termino el proceso
  newRecipeWindow.on('closed', () => {
    newRecipeWindow = null;
  });
}

/* crea la ventana acerca de */
function createAcercaDe() {
  acercaDeWindow = new BrowserWindow({
    width: 300,
    height: 250,
    resizable: false,
    icon: image,
    title: 'Acerca de'
  });

  //quito el navbar
   acercaDeWindow.setMenu(null);

  //cargo el acerca-de.html
  acercaDeWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'views/acerca-de.html'),
    protocol: 'file',
    slashes: true
  }));

  //cuando cierro la ventana termino el proceso
  acercaDeWindow.on('closed', () => {
    acercaDeWindow = null;
  });
}

/* dialogo para importar backup */
function importBackup() {
  dialog.showOpenDialog({ 
    properties: ['openFile', 'multiSelections'],
    filters: [      
      { name: 'Files', extensions: ['txt'] }
    ]
  }, function (files) {
      //si no esta vacio files== ruta del archivo seleccionado
      if (files !== undefined) {
        //compruebo si existe dataRecipes.txt y si no lo creo
        fileDataExists();
        //ahora compruebo si existe el archivo de backup
        if (fs.existsSync(files[0])){
          //copio el contenido del backup a dataNotes.txt
          fs.readFile(files[0], 'utf8', function (err, contentsBackup) {
            //array con las lineas del archivo
            let contenidoBackup = contentsBackup.split("\n");
            //vacio el archivo dataRecipes.txt
            fs.truncate('dataRecipes.txt', 0, function (err) {if (err) {} });
            //ahora sobreescrivo el archivo dataRecipes.txt con el contenido del backup importado
            //recorro el array con el contenido del backup
            contenidoBackup.forEach(element => {
              fs.createWriteStream("dataRecipes.txt", { flags: 'a' }).write(element + "\n");            
            });
          });
        }else{
          errorMessage('Ruta invalida o fichero dañado');
        }
        //recargo la ventana despues de importar
        mainWindow.reload();        
      }else{
        errorMessage('No se a cargado ningun archivo');
      }
  });
}

/* exporta el backup a la localizacion deseada */
function exportBackup() {
  dialog.showSaveDialog({
    filters: [{
      name: 'Backup_recetas',
      extensions: ['txt']
    }]
  }, function (files) {   
      //compruebo si existe dataNotes.txt y creo el backup
      if (fs.existsSync('dataRecipes.txt')){
        //copio el archivo a la ubicacion seleccionada 
        fs.createReadStream('dataRecipes.txt').pipe(fs.createWriteStream(files));
      }else{
        errorMessage('Error al exportar la copia');
      }
  });
}


/* funcion que carga las notas guardadas al cargar el programa */
function loadDataRecipes() {  
  //si existe el archivo cargo las notas guardadas
  if (fs.existsSync('dataRecipes.txt')) {
    fs.readFile('dataRecipes.txt', 'utf8', function (err, contents) {
      //Creo el array con el contenido del archivo cortando por linea
      //let contenido = contents.split("\n");
      let contenido = contents.split("%!");
      //elimino el retorno de carro del array (ultimo elemento)
      contenido.pop();
      //recorro el array y corto por el caracter de control "|%"
      contenido.forEach(element => {
        if(element != ''){
          //creo array con titulo, contenido
          let partes = element.split("|%");        
          //creo el objeto
          const newRecipe = {
            title: partes[0],
            content: partes[1],
            id: contenido.indexOf(element) //id para despues borrar la receta
          };

          //cuando el proceso estea listo para escuchar mando los datos
          mainWindow.webContents.on('did-finish-load', () => {    
            //mando los datos a la pantalla principal
            mainWindow.webContents.send('recipes:load', newRecipe);
          });
        }
      });

      if (err) {
        errorMessage('Error al cargar las recetas guardadas"');
      }
    });
  }  
}

/* funcion que comprueba si el archivo dataRecipes.txt existe, y si no lo crea */
function fileDataExists(){
  //creo el archivo si no existe
  if (!fs.existsSync('dataRecipes.txt')){
    fs.appendFile('dataRecipes.txt','',(error) => {
      if(error){
        errorMessage('Error al crear el archivo de respaldo');
      }
    });
  }
}

/* funcion para guardar las notas en un archivo */
function saveInFile(recipe) {
  //creo el archivo si no existe
  fileDataExists();

  //guardo el nuevo contenido
  var stream = fs.createWriteStream("dataRecipes.txt", { flags: 'a' });
  //solucion saltros de linea
  stream.write(recipe.title + '|%' + recipe.content + '%!' + "\n");  
  //cierro el stream
  stream.end();
}

/* elimina el archivo al eliminar todas las notas */
/* function deleteDataRecipes() {
  fs.unlink("dataRecipes.txt", (err) => {
    if (err) {
      errorMessage('Error al eliminar el archivo "dataRecipes.txt"');
    }
  });
} */

/* escucho el evento de guardar una nueva nota */
ipcMain.on('recipe:new', (e, newRecipe) => {
  // send to the Main Window
  mainWindow.webContents.send('recipe:new', newRecipe);
  //guardo la nota en archivo
  saveInFile(newRecipe);  
  //cierro la ventana de nueva nota
  newRecipeWindow.close();  
});



// Menu Template
const templateMenu = [
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Nueva receta',
        accelerator: 'Ctrl+N',
        click() {
          createNewRecipe();
        }
      },
      /* { //quirado por seguridad, solo se permite borrado individual de recetas
        label: 'Borrar todo',
        accelerator: process.platform == 'darwin' ? 'command+D' : 'Ctrl+D',
        click() {
          mainWindow.webContents.send('recipe:remove-all');
          //elimino el archivo que contiene las notas
          deleteDataRecipes();
        }

      }, */      
      {
        label: 'Recargar',
        role: 'reload'       
      },
      {
        label: 'Salir',
        accelerator: process.platform == 'darwin' ? 'command+Q' : 'Ctrl+Q',
        click() {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Respaldo',
    submenu: [
      {        
        label: 'Importar Backup(txt)',
        click() {
          importBackup();
        }
      },
      {
        label: 'Exportar Backup',
        click() {
          exportBackup();
        }
      }
    ]
  },
  {
    label: 'Ayuda',
    submenu: [
      {
        label: 'Acerca de',
        click() {
          createAcercaDe();
        }
      }
    ]
  }
];

/* detecto el click en el boton para abrir la ventana de nueva receta */
ipcMain.on('buttonNewRecipes', () => {
  createNewRecipe();
})


/* Si se habre la aplicacion en MAC, en el navbar nos aparece una opcion con el
nombre de la aplicacion, para evitar esto, compruebo si estoy en mac */
if (process.platform === 'darwin') {
  templateMenu.unshift({
    label: app.getName(),
  });
};

/* activo las opciones de desarrollo en navbar si estoy en produccion  */
if (process.env.NODE_ENV !== 'production') {
  templateMenu.push({
    label: 'DevTools',
    submenu: [
      {
        label: 'Mostrar/ocultar DevTools',
        accelerator: process.platform == 'darwin' ? 'F12' : 'F12',
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
      //pestaña para refrescar la pagina
      {
        role: 'reload'
      }
    ]
  })
}

/* funcion que envia un mensaje de error a la ventana principal */
function errorMessage(message) {
  //cuando el proceso estea listo para escuchar mando los datos
  mainWindow.webContents.on('did-finish-load', () => {
    //mando los datos a la pantalla principal
    mainWindow.webContents.send('error:alert', message);
  });
}


/* funcion que envia un mensaje de ok */
function okMessage(message) {
  //cuando el proceso estea listo para escuchar mando los datos
  mainWindow.webContents.on('did-finish-load', () => {
    //mando los datos a la pantalla principal
    mainWindow.webContents.send('ok:alert', message);
  });
}
