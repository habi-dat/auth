const auth = require('../utils/auth');
const discoursehelper = require('../utils/discoursehelper');
const express = require('express');
const Promise = require("bluebird");

const router = express.Router();

const validateCategory = async (category) => {
  return Promise.resolve()
    .then(() => {
      var errors = [];
      if ('slug' in category) {
        if (!(/^[A-Za-z0-9-]{2,}[A-Za-z0-9]+$/.test(category.slug))) {
          errors.push('Name für URL: mindestens 3 Zeichen, Wörter mit Bindestrich getrennt');
        }
      }
      if ('name' in category) {
        if (!(/^.{3,}$/.test(category.name))) {
          errors.push('Anzeigename: mindestens 3 Zeichen');
        }
      }
      if ('color' in category) {
        if (category.color.length !== 6) {
          errors.push('Hintergrundfarbe: Muss eine Farbe im Webformat (Hex) sein');
        }
      }
      if ('text_color' in category) {
        if (category.text_color.length !== 6) {
          errors.push('Vordergrundfarbe: Muss eine Farbe im Webformat (Hex) sein');
        }
      }

      if (errors.length > 0) {
        throw {status: 400, message: errors.join("\n")};
      } else {
        return category;
      }
    })
}


router.get('/api/categories', auth.isLoggedInAdmin, function(req, res, next) {
  return discoursehelper.getCategories()
    .then(discoursehelper.populateCategoryGroups)
    .then(categories => {
      return res.send({categories: categories})
    })
    .catch(next);
})

router.get('/api/category/:id', auth.isLoggedInAdmin, function(req, res, next) {
  return discoursehelper.getCategory(req.params.id)
    .then(category => {
      return res.send({category: category})
    })
    .catch(next);
})

// CREATE CATEGORY

router.post('/api/category/create', auth.isLoggedInAdmin, function(req, res, next) {
  var category = {
    name: req.body.name,
    slug: req.body.slug,
    groups: req.body.groups,
    color: req.body.color,
    text_color: req.body.text_color,
    parent: req.body.parent
  };
  return validateCategory(category)
    .then(() => discoursehelper.createCategory(category))
    .then(() => res.send({status: 'success', message: 'Kategorie ' + category.name + ' wurde erstellt.'}))
    .catch(next);
});

// UPDATE CATEGORY

router.post('/api/category/update', auth.isLoggedInAdmin, function(req, res, next) {
  var category = {
    id: req.body.id,
    name: req.body.name,
    slug: req.body.slug,
    groups: req.body.groups,
    color: req.body.color,
    text_color: req.body.text_color,
    parent: req.body.parent
  };
  return validateCategory(category)
    .then(() => discoursehelper.updateCategory(category))
    .then(() => res.send({status: 'success', message: 'Kategorie ' + category.name + ' wurde geändert.'}))
    .catch(next);
});

router.delete('/api/category/:id', auth.isLoggedInAdmin, function(req, res, next) {
  return discoursehelper.deleteCategory(req.params.id)
    .then(() => res.send({status: 'success'}))
    .catch(next);
})

router.get('/api/category/available/name/:name', auth.isLoggedInGroupAdmin, function(req, res, next) {
  return discoursehelper.getCategories()
    .then(categories => {
      if (categories.find(cat => cat.name === req.params.name)) {
        res.send({available: false});
      } else {
        res.send({available: true});
      }
    })
    .catch(next)
});

router.get('/api/category/available/slug/:slug', auth.isLoggedInGroupAdmin, function(req, res, next) {
  return discoursehelper.getCategories()
    .then(categories => {
      if (categories.find(cat => cat.slug === req.params.slug)) {
        res.send({available: false});
      } else {
        res.send({available: true});
      }
    })
    .catch(next)
});

module.exports = router;