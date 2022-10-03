<template>
  <v-row style="height: 100%;">
    <v-col sm="12" md="4">
      <v-form
        v-if="loaded"
        ref="form"
        v-model="valid">

        <v-text-field
          prepend-icon="label"
          v-model="category.name"
          :rules="[v => /^.{3,}$/.test(v) || 'mindestens 3 Zeichen', v => !!v || 'darf nicht leer sein']"
          :error-messages="errors.name"
          @change="checkNameAvailability"
          @input="updateSlug"
          hint="mindestens 3 Zeichen"
          label="Anzeigename"
          required
        />
        <v-text-field
          prepend-icon="link"
          v-model="category.slug"
          :rules="[v => /^[A-Za-z0-9-]{2,}[A-Za-z0-9]+$/.test(v) || 'mindestens 3 Zeichen, Wörter mit Bindestrich getrennt']"
          :error-messages="errors.slug"
          @change="checkSlugAvailability"
          label="Name für URL">
        </v-text-field>
        <ColorField
          icon="format_paint"
          label="Hintergrundfarbe"
          v-model="category.color"
        />
        <ColorField
          icon="format_color_text"
          label="Vordergrundfarbe"
          v-model="category.text_color"
        />
        <v-select
          :disabled="category.children && category.children.length > 0"
          :items="parentCategories"
          item-text="name"
          item-value="id"
          prepend-icon="expand_less"
          v-model="category.parent"
          label="Überkategorie">
        </v-select>
        <MemberField
          v-if="showGroups"
          icon="groups"
          label="Berechtigte Gruppen"
          v-model="category.groupsPopulated"
          @input="selectGroups"
          :rules="[v => v.length > 1 || !!v || 'mindestens 1 Gruppe muss berechtigt sein']"
          itemText="o"
          itemValue="cn"
          tooltip="group"
          close
        />
      </v-form>
    </v-col>
    <v-divider vertical />
    <v-col md="" sm="12" minHeight="400" style="height: 100%; min-height: 400px; overflow: hidden;">
      <Toolbar title="Gruppenberechtigungen" icon="groups" search searchPosition="right" :searchText.sync="search"/>
      <GroupTable
        v-if="loaded"
        :groups="groups"
        :search="search"
        @selectGroup="onSelectGroup"
        @onGridReady="params => groupGripApi = params.api"
        @onDataRendered="selectGroups"
        rowSelection="multiple"
        :heightOffset="30" />
    </v-col>
  </v-row>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import MemberField from '@/components/form/MemberField'
import ColorField from '@/components/form/ColorField'
import GroupTable from '@/components/group/GroupTable'
import Toolbar from '@/components/layout/Toolbar'

export default {
  props: {
    category: Object,
    showGroups: Boolean
  },
  components: { MemberField, GroupTable, Toolbar, ColorField },
  data() {
    return {
      errors: {
        name: [],
        slug: []
      },
      search: '',
      groups: [],
      valid: false,
      oldCategory: {},
      parentCategories: [],
      loaded: false
    }
  },
  watch: {
    "valid": function(newValue, oldValue) {
      this.$emit('valid', newValue);
    }
  },
  methods: {
    onSelectGroup: function(group, selected) {
      if (selected && !this.category.groupsPopulated.find(g => g.dn === group.dn)) {
        this.category.groupsPopulated.push(group);
      } else if (!selected && this.category.groupsPopulated.find(g => g.dn === group.dn)) {
        this.category.groupsPopulated.splice(this.category.groupsPopulated.findIndex(g => g.dn === group.dn), 1);
      }
      this.category.groups = this.category.groupsPopulated.map(g => g.cn);
    },
    selectGroups() {
      if (!this.category.populateGroups) {
        this.category.groups = this.category.groupsPopulated.map(g => g.cn);
      }
      this.groupGripApi.forEachNode((rowNode, index) => {
        if (this.category.groups.includes(rowNode.data.cn)) {
          if (this.category.populateGroups && !this.category.groupsPopulated.find(g => g.dn === rowNode.data.dn)) {
            this.category.groupsPopulated.push(rowNode.data)
          }
          rowNode.setSelected(true);
        } else {
          rowNode.setSelected(false);
        }
      });
      this.category.populateGroups = false;
    },
    async checkNameAvailability (name) {
      this.errors.name = []
      if (name !== this.oldCategory.name) {
        try {
          await axios.get('/api/category/available/name/' + name)
            .then(response => {
              if(!response.data.available) {
                this.errors.name.push('Kategorienname ist leider bereits vergeben')
              }
            })
        } catch(error) {}
      }
    },
    async checkSlugAvailability (slug) {
      this.errors.slug = []
      if (slug !== this.oldCategory.slug) {
        try {
          await axios.get('/api/category/available/slug/' + slug)
            .then(response => {
              if(!response.data.available) {
                this.errors.slug.push('Kategorien-URL ist leider bereits vergeben')
              }
            })
        } catch(error) {}
      }
    },
    updateSlug(newName) {
      this.category.slug = newName
        .toLowerCase()
        .replaceAll('ä', 'ae')
        .replaceAll('ö', 'oe')
        .replaceAll('ü', 'ue')
        .replaceAll('ß', 'ss')
        .replaceAll(' ', '-')
        .replaceAll(/[^a-z-]+/g,"")
    },
    getData: function () {
      axios.get('/api/groups')
        .then(response => {
          this.groups = response.data.groups;
          this.category.groupsPopulated = [];
          this.category.populateGroups = true;
          return axios.get('/api/categories')
            .then(response => {
              // filter categories to only show root level categories
              this.parentCategories = [{id:-1, name: '(keine Überkategorie)'}].concat(response.data.categories.filter(c => c.parent === -1 && c.id !== this.category.id));
              this.loaded = true;
            })
        })
        .catch(e => {});
    }
  },
  created() {
    this.category.parent = this.category.parent || -1;
    this.oldCategory = {... this.category};
    this.getData();
  }
}
</script>