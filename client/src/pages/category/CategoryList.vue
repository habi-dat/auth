<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Kategorien" icon="forum" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="edit"
          tooltip="Kategorie bearbeiten"
          color="info"
          @click="updateCategory"
          :disabled="selectedCategories.length === 0"
        />
        <ToolbarButton
          icon="delete"
          tooltip="Kategorie löschen"
          color="error"
          :loading="loading"
          @click="deleteCategory"
          :disabled="selectedCategories.length === 0"
        />
        <ToolbarButton
          icon="add"
          tooltip="Kategorie erstellen"
          color="success"
          to="/category/create"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height:100%;overflow: hidden;">
      <CategoryTable
        v-if="loaded"
        :categories="categories"
        :search="search"
        @selectionChanged="onSelectionChanged"
        @onGridReady="onGridReadyHandler"
      />
    </v-card-text>
    <ConfirmDialog ref="confirm" />
  </v-card>
</template>

<script>

import axios from 'axios'
import router from '@/router'
import CategoryTable from '@/components/category/CategoryTable'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { CategoryTable, ConfirmDialog, Toolbar, ToolbarButton },
  data() {
    return {
      categories: [],
      selectedCategories: [],
      loaded: false,
      loading: false,
      search: '',
      gridApi: null
    }
  },
  methods: {
    onGridReadyHandler(params) {
      this.gridApi = params.api;
    },
    onSelectionChanged: function(selectedRows) {
      this.selectedCategories = selectedRows;
    },
    async deleteCategory() {

      var category = this.selectedCategories[0];
      if (await this.$refs.confirm.open('Bist du sicher?','Willst du die Kategorie ' + category.name + ' wirklich löschen?')) {
        this.loading = true;
        axios.delete('/api/category/' + category.id)
          .then(response => {
            if (response.data.status === 'success') {
              this.$snackbar.success('Kategorie ' + category.name + ' gelöscht')
              this.loading = false;
              this.gridApi.applyTransaction({ remove: [category]});
            }
          })
          .catch(e => {this.loading=false;})
      }
    },
    updateCategory() {
      router.push('/category/update?id=' + this.selectedCategories[0].id)
    },
    getData: function () {
      axios.get('/api/categories')
        .then(response => {
          this.categories = response.data.categories;
          this.loaded = true;
        })
        .catch(e => {});
    }
  },
  async created() {
    this.getData();
  }
}
</script>