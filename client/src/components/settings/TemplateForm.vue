<template>
  <v-row style="height: 100%;">
    <v-col sm="12" md="12">
      <v-form
        ref="form"
        v-model="valid">
        <v-checkbox
          v-model="template.activated"
          label="Eigene Vorlage verwenden"
        />
        <v-text-field
          v-if="template.activated"
          prepend-icon="label"
          v-model="template.subject"
          :rules="[v => !!v || 'darf nicht leer sein']"
          label="Betreff"
          required
        />
        <div class="container" height="100%" style="display: flex; flex-direction: column; position:relative; height:100%">
        <div :id="'gjs_' + id" v-show="template.activated"></div>
      </div>
      </v-form>
    </v-col>
  </v-row>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import 'grapesjs/dist/grapes.min.js'
import newsLetter from "grapesjs-preset-newsletter-v2";
//import 'grapesjs-preset-webpage/dist/grapesjs-preset-webpage.min.css'
//import 'grapesjs-preset-webpage/dist/grapesjs-preset-webpage.min.js'

export default {
  components: {  },

  props: {
    template: Object,
    id: String
  },
  data() {
    return {
      valid: false,
      editor: null
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue);
    },
    "template.activated": function(newValue, oldValue) {
      if (newValue && !this.editor) {
        this.initEditor();
      }
    }
  },
  methods: {
    initEditor() {
      this.editor = grapesjs.init({
       container: '#gjs_' + this.id,
       height: '650px',
       width: '100%',
       plugins: ['gjs-preset-newsletter'],
       storageManager: false,
  /*     storageManager: {
         id: 'gjs-',
         type: 'local',
         autosave: true,
         storeComponents: true,
         storeStyles: true,
         storeHtml: true,
         storeCss: true,
       },*/
       deviceManager: {
         devices:
         [
           {
             id: 'desktop',
             name: 'Desktop',
             width: '',
           },
           {
             id: 'tablet',
             name: 'Tablet',
             width: '768px',
             widthMedia: '992px',
           },
           {
             id: 'mobilePortrait',
             name: 'Mobile portrait',
             width: '320px',
             widthMedia: '575px',
           },
         ]
       },
        pluginsOpts: {
          "gjs-preset-newsletter": {
            inlineCss: true,
          },
        }
     })
      if (this.template.body) {
        this.editor.setComponents(this.template.body)
      }
      this.$emit('editorReady', this.editor)
    }
  },
  mounted() {
    grapesjs.plugins.add("gjs-preset-newsletter", newsLetter);
    if (this.template.activated) {
      this.initEditor();
    }
  }
}
</script>
