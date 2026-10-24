package dev.pokebacon.studio;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

public class ExportProvider extends ContentProvider {
    @Override public boolean onCreate(){return true;}
    private File resolve(Uri uri) throws FileNotFoundException {
        File folder=new File(getContext().getCacheDir(),"exports");String name=uri.getLastPathSegment();if(name==null||name.contains("/")||name.contains("\\"))throw new FileNotFoundException();
        try{File file=new File(folder,name).getCanonicalFile();if(!file.getParentFile().equals(folder.getCanonicalFile())||!file.isFile())throw new FileNotFoundException();return file;}catch(IOException error){throw new FileNotFoundException();}
    }
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(resolve(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){try{File file=resolve(uri);String[] columns=projection!=null?projection:new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE};MatrixCursor result=new MatrixCursor(columns);Object[] values=new Object[columns.length];for(int i=0;i<columns.length;i++){if(OpenableColumns.DISPLAY_NAME.equals(columns[i]))values[i]=file.getName();else if(OpenableColumns.SIZE.equals(columns[i]))values[i]=file.length();}result.addRow(values);return result;}catch(FileNotFoundException error){return null;}}
    @Override public String getType(Uri uri){String name=uri.getLastPathSegment();if(name==null)return "application/octet-stream";if(name.endsWith(".png"))return "image/png";if(name.endsWith(".json"))return "application/json";if(name.endsWith(".zip"))return "application/zip";return "application/octet-stream";}
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] args){throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String selection,String[] args){throw new UnsupportedOperationException();}
}
